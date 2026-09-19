import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import pc from 'picocolors';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { createTaskLogger } from './taskLogger.js';
import type { TaskEvent } from '../core/types.js';

export interface IpcMessagePayload {
  step?: string;
  start?: boolean;
  end?: boolean;
  duration?: number;
  error?: string;
  title?: string;
  meta?: Record<string, any>;
  list?: Array<Record<string, string>>;
  ok?: boolean;
  [key: string]: unknown;
}

export type Message = {
  event: string;
  payload?: IpcMessagePayload;
};

export class IpcServer extends EventEmitter {
  env: Record<string, unknown>;
  group: string;
  noLogs: unknown;
  socketPath: string;
  server: net.Server | null;
  private clients: Set<net.Socket> = new Set();
  private taskLogger: (event: TaskEvent) => void;
  private currentTaskId: string = 'task';

  constructor(env: Record<string, unknown>, group = 'Fastlane') {
    super();
    this.env = env;
    this.group = group;
    this.noLogs = env.NO_LOGS;
    this.socketPath = path.join(
      os.tmpdir(),
      `nf_ipc_${crypto.randomUUID()}.sock`,
    );
    this.server = null;
    this.taskLogger = createTaskLogger();
    this.on('message', (msg: Message) => this.handleMessage(msg));
  }

  private handleMessage(msg: Message) {
    if (!msg.event) return;

    const payload = msg.payload || {};
    const title = payload.title || msg.event;
    const stepId = payload.step ? String(payload.step) : msg.event;

    // 1. start === true -> Pipeline step başlar
    if (payload.start === true) {
      this.currentTaskId = stepId;
      this.taskLogger({
        type: 'start',
        id: stepId,
        title,
      });
      return;
    }

    // 2. end === true -> Pipeline step biter
    if (payload.end === true) {
      const isOk = payload.ok !== false && !payload.error;
      const id = this.currentTaskId || stepId;

      if (isOk) {
        const durationStr =
          payload.duration !== undefined ? `${payload.duration}s` : undefined;
        this.taskLogger({
          type: 'success',
          id,
          message: durationStr,
        });
      } else {
        this.taskLogger({
          type: 'error',
          id,
          error: payload.error || 'Task failed',
        });
      }
      return;
    }

    // 3. payload.list -> format lines and send as message
    const list = payload.list || (payload.meta as any)?.list;
    if (list && Array.isArray(list)) {
      if (msg.event) {
        this.taskLogger({
          type: 'message',
          id: this.currentTaskId,
          message: msg.event,
        });
      }
      for (const item of list) {
        const line = Object.entries(item)
          .map(([k, v]) => `${pc.dim(k + ':')} ${pc.green(v)}`)
          .join(' | ');
        this.taskLogger({
          type: 'message',
          id: this.currentTaskId,
          message: line,
        });
      }
      return;
    }

    // 4. ipc_wrapper ve diğer aksiyonlardan gelen salt mesaj olayları
    this.taskLogger({
      type: 'message',
      id: this.currentTaskId,
      message: msg.event,
      payload: payload.meta
    });
  }

  async start() {
    // In cmd-bin convention:
    // NO_LOGS=true means quiet/clean mode: Fastlane raw stdout is ignored,
    // and filtered IPC events are rendered live to the console.
    // NO_LOGS=false (or undefined) means verbose mode: Fastlane raw stdout is piped directly,
    // so IPC live rendering is disabled to avoid conflicting terminal output.
    if (!this.noLogs) return () => {};

    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch (e) {}
      }

      this.server = net.createServer((client) => {
        this.clients.add(client);
        client.on('close', () => {
          this.clients.delete(client);
        });
        client.on('error', () => {
          this.clients.delete(client);
        });

        let buffer = '';
        client.on('data', (data) => {
          buffer += data.toString();
          const parts = buffer.split('\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (part.trim()) {
              try {
                const event = JSON.parse(part);
                this.emit('message', event);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.socketPath, () => {
        this.env.NF_IPC_SOCKET = this.socketPath;
        process.env.NF_IPC_SOCKET = this.socketPath;
        if (globalThis._constants.ENV) {
          globalThis._constants.ENV.NF_IPC_SOCKET = this.socketPath;
        }
        resolve(() => {
          this.stop();
        });
      });
    });
  }

  stop() {
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch (e) {}
    }
    this.clients.clear();

    if (this.server) {
      this.server.close((err) => {
        if (!err) {
          this.server = null;
          globalThis._constants.IPC_SERVER_STOP = () => {};
        }
      });
    }
    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch (e) {
        // ignore
      }
    }
  }
}

export function withIpcServer<T extends (...args: any[]) => any>(action: T) {
  return async (...args: Parameters<T>) => {
    const env = globalThis._constants.ENV as Record<string, unknown>;

    const ipcServer = new IpcServer(env);
    globalThis._constants.IPC_SERVER_STOP =
      (await ipcServer.start()) as () => void;

    try {
      return await action(...args);
    } finally {
      globalThis._constants.IPC_SERVER_STOP?.();
    }
  };
}

import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

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

export type IpcMessage = {
  event: string;
  payload?: IpcMessagePayload;
};

export class CoreIpcServer extends EventEmitter {
  socketPath: string;
  server: net.Server | null = null;
  private clients: Set<net.Socket> = new Set();

  constructor() {
    super();
    this.socketPath = path.join(
      os.tmpdir(),
      `nf_ipc_${crypto.randomUUID()}.sock`,
    );
  }

  async start(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch {}
      }

      this.server = net.createServer((client) => {
        this.clients.add(client);
        client.on('close', () => this.clients.delete(client));
        client.on('error', () => this.clients.delete(client));

        let buffer = '';
        client.on('data', (data) => {
          buffer += data.toString();
          const parts = buffer.split('\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (part.trim()) {
              try {
                const event = JSON.parse(part);
                this.emit('message', event as IpcMessage);
              } catch {}
            }
          }
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.socketPath, () => {
        process.env.NF_IPC_SOCKET = this.socketPath;
        if (globalThis._constants?.ENV) {
          globalThis._constants.ENV.NF_IPC_SOCKET = this.socketPath;
        }
        resolve(() => this.stop());
      });
    });
  }

  stop() {
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch {}
    }
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {}
    }
  }
}

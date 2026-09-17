import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import pc from 'picocolors';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { spinner, stream } from '@clack/prompts';
import { createLiveSummary, type LiveSummary } from './live_summary.js';

export const S = spinner({
  indicator: 'dots',
  cancelMessage: '',
});

export interface PipelineStepDef {
  id: string;
  title: string;
}

export const PIPELINE_STEPS = [
  { id: 'setup', title: 'Setup' },
  { id: 'install', title: 'Install' },
  { id: 'prebuild', title: 'Prebuild' },
  { id: 'build', title: 'Build' },
  { id: 'postbuild', title: 'Postbuild' },
  { id: 'prerelease', title: 'Prerelease' },
  { id: 'release', title: 'Release' },
  { id: 'postrelease', title: 'Postrelease' },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]['id'];

export interface IpcMessagePayload {
  step?: string;
  sub_step?: boolean;
  start?: boolean;
  end?: boolean;
  duration?: number;
  error?: string;
  steps?: Array<string | PipelineStepDef>;
  title?: string;
  meta?: Record<string, any>;
  list?: Array<Record<string, string>>;
  ok?: boolean;
  url?: string;
  download?: string;
  console?: string;
  testing?: string;
  version?: string;
  [key: string]: unknown;
}

export type Message = {
  event: string;
  payload?: IpcMessagePayload;
};

const defaultMessageLogger = (msg: Message, group = 'Fastlane') => {
  if (msg.event) {
    const timeString = new Date().toTimeString().split(' ')[0];
    const message = `${pc.dim(pc.gray(`(${timeString})`))} ${pc.dim(pc.cyan(`⚡  [${group}]:`))} ${pc.white(msg.event)}`;
    if (msg.payload?.start) {
      S.start(message);
    } else if (msg.payload?.end) {
      S.stop(message);
    } else {
      S.message(message);
    }

    if (msg.payload?.list) {
      const list: string[] = [];
      for (const item of msg.payload?.list ?? []) {
        let str = '';
        Object.entries(item).forEach(
          ([key, value]: [string, string], index: number) => {
            str += `${pc.dim(key + ':')} ${pc.green(value)}${index === Object.keys(item).length - 1 ? '' : ' | '}`;
          },
        );
        list.push(str);
      }
      stream.message(list.map((str) => `${str}\n`));
    }
  }
};

export class IpcServer extends EventEmitter {
  env: Record<string, unknown>;
  group: string;
  noLogs: unknown;
  socketPath: string;
  server: net.Server | null;
  liveSummary: LiveSummary | null = null;
  activePipelineStep: string | null = null;
  private clients: Set<net.Socket> = new Set();

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
    this.on('message', (msg: Message) => this.handleMessage(msg));
  }

  private initPipelineSummary(
    steps?: Array<string | PipelineStepDef>,
    title?: string,
  ) {
    let tasks: Array<{ id: string; title: string }>;

    if (steps && steps.length > 0) {
      tasks = steps.map((s) => {
        if (typeof s === 'string') {
          const defaultStep = PIPELINE_STEPS.find((d) => d.id === s);
          return (
            defaultStep || {
              id: s,
              title: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '),
            }
          );
        }
        return { id: String(s.id), title: String(s.title) };
      });
    } else {
      tasks = PIPELINE_STEPS.filter((s) => s.id !== 'install').map((step) => ({
        id: step.id,
        title: step.title,
      }));
    }

    const summaryTitle = title || `${this.group} Pipeline`;

    this.liveSummary = createLiveSummary({
      title: summaryTitle,
      tasks,
    });
    this.liveSummary.start();
  }

  private handleMessage(msg: Message) {
    // 1. Pipeline initialization: creates and starts LiveSummary skeleton
    if (msg.event === 'pipeline_init') {
      const steps = Array.isArray(msg.payload?.steps)
        ? (msg.payload!.steps as Array<string | PipelineStepDef>)
        : undefined;
      const title =
        typeof msg.payload?.title === 'string' ? msg.payload.title : undefined;
      if (this.liveSummary) {
        if (title) this.liveSummary.setTitle(title);
        if (steps && steps.length > 0) {
          const currentItems = this.liveSummary.getItems();
          const matches =
            currentItems.length === steps.length &&
            steps.every((s, idx) => {
              const stepId = typeof s === 'string' ? s : s.id;
              return currentItems[idx]?.id === stepId;
            });
          if (!matches) {
            this.liveSummary.stop();
            this.initPipelineSummary(steps, title);
          }
        }
      } else {
        this.initPipelineSummary(steps, title);
      }
      return;
    }

    // 2. Pipeline step lifecycle events
    if (msg.event === 'pipeline_step_start') {
      const title =
        typeof msg.payload?.title === 'string' ? msg.payload.title : undefined;
      const steps = Array.isArray(msg.payload?.steps)
        ? (msg.payload!.steps as Array<string | PipelineStepDef>)
        : undefined;
      if (!this.liveSummary) {
        this.initPipelineSummary(steps, title);
      } else if (title && this.liveSummary.title !== title) {
        this.liveSummary.setTitle(title);
      }
      const stepId = String(msg.payload?.step || '');
      this.activePipelineStep = stepId;
      this.liveSummary?.updateItem(stepId, { state: 'running' });
      return;
    }

    if (msg.event === 'pipeline_step_end') {
      const stepId = String(msg.payload?.step || this.activePipelineStep || '');
      const duration =
        msg.payload?.duration !== undefined
          ? `${msg.payload.duration}s`
          : undefined;

      this.liveSummary?.setSubStep(stepId, undefined);
      const currentItem = this.liveSummary?.getItem(stepId);
      this.liveSummary?.updateItem(stepId, {
        state: 'ok',
        runningMessage: undefined,
        result: {
          ok: true,
          extra: duration,
          subItems: currentItem?.result?.subItems,
          meta: currentItem?.result?.meta,
        },
      });

      if (this.activePipelineStep === stepId) {
        this.activePipelineStep = null;
      }
      return;
    }

    if (msg.event === 'pipeline_step_fail') {
      const stepId = String(msg.payload?.step || this.activePipelineStep || '');
      this.liveSummary?.setSubStep(stepId, undefined);
      const currentItem = this.liveSummary?.getItem(stepId);
      this.liveSummary?.updateItem(stepId, {
        state: 'fail',
        runningMessage: undefined,
        result: {
          ok: false,
          message:
            typeof msg.payload?.error === 'string'
              ? msg.payload.error
              : undefined,
          subItems: currentItem?.result?.subItems,
          meta: currentItem?.result?.meta,
        },
      });

      if (this.activePipelineStep === stepId) {
        this.activePipelineStep = null;
      }
      return;
    }

    if (msg.event === 'pipeline_finish') {
      if (this.liveSummary) {
        this.liveSummary.stop();
        this.liveSummary = null;
      }
      return;
    }

    // 3. Sub-step events nested under an active or targeted pipeline step
    if (this.liveSummary) {
      let targetStep = String(
        msg.payload?.step || this.activePipelineStep || '',
      );

      // If targetStep is not registered, fallback to active step or currently running item
      if (!this.liveSummary.getItem(targetStep)) {
        if (
          this.activePipelineStep &&
          this.liveSummary.getItem(this.activePipelineStep)
        ) {
          targetStep = this.activePipelineStep;
        } else {
          const running = this.liveSummary
            .getItems()
            .find((i) => i.state === 'running');
          if (running) {
            targetStep = running.id;
          }
        }
      }

      if (targetStep && this.liveSummary.getItem(targetStep)) {
        if (msg.payload?.start) {
          this.liveSummary.setSubStep(targetStep, msg.event);
        } else if (msg.payload?.end) {
          this.liveSummary.setSubStep(targetStep, undefined);

          const meta: Record<string, any> = { ...(msg.payload?.meta || {}) };
          if (msg.payload?.url) meta['URL'] = msg.payload.url;
          if (msg.payload?.download) meta['Download'] = msg.payload.download;
          if (msg.payload?.console) meta['Console'] = msg.payload.console;
          if (msg.payload?.testing) meta['Testing'] = msg.payload.testing;
          if (msg.payload?.version) meta['Version'] = msg.payload.version;

          this.liveSummary.addOrUpdateSubItem(targetStep, {
            label: msg.event,
            ok: msg.payload?.ok !== false,
            meta: Object.keys(meta).length > 0 ? meta : undefined,
          });
        } else {
          // Plain informational event without explicit start/end: record as completed milestone
          this.liveSummary.addOrUpdateSubItem(targetStep, {
            label: msg.event,
            ok: true,
          });
        }
      }
      // When LiveSummary is active, never fall through to defaultMessageLogger to avoid conflicting spinners
      return;
    }

    // 4. Fallback: Standalone actions outside pipeline use spinner & stream logging
    defaultMessageLogger(msg, this.group);
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
          buffer = parts.pop() ?? ''; // Incomplete part stays in buffer

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
    if (this.liveSummary) {
      this.liveSummary.stop();
      this.liveSummary = null;
    }
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


import net from "node:net";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import pc from "picocolors";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { getWorkspaceEnv } from "./workspace_env.js";
import { spinner, log, taskLog, stream } from "@clack/prompts";

export const S = spinner({
  indicator: "dots",
  cancelMessage: "",
});
type Message = {
  event: string;
  payload?: Record<string, unknown> & { list?: Array<Record<string, string>> };
};

const defaultMessageLogger = (msg: Message, group = "Fastlane") => {
  if (msg.event) {
    const timeString = new Date().toTimeString().split(" ")[0];
    const message = `${pc.dim(pc.gray(`(${timeString})`))} ${pc.dim(pc.cyan(`⚡  [${group}]:`))} ${pc.white(msg.event)}`;
    if (msg.payload?.start) {
      S.start(message);
    } else if (msg.payload?.end) {
      S.stop(message);
    } else {
      S.message(message);
    }

    if (msg.payload?.list) {
      let list = [];
      for (const item of msg.payload?.list ?? []) {
        let str = "";
        Object.entries(item).forEach(
          ([key, value]: [string, string], index: number) => {
            str += `${pc.dim(key + ":")} ${pc.green(value)}${index === Object.keys(item).length - 1 ? "" : " | "}`;
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

  constructor(env: Record<string, unknown>, group = "Fastlane") {
    super();
    this.env = env;
    this.group = group;
    this.noLogs = env.NO_LOGS;
    this.socketPath = path.join(
      os.tmpdir(),
      `nf_ipc_${crypto.randomUUID()}.sock`,
    );
    this.server = null;
    this.on(
      "message",
      (msg: { event: string; payload: Record<string, unknown> }) =>
        defaultMessageLogger(msg, this.group),
    );
  }

  async start() {
    if (!this.noLogs) return () => {};
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch (e) {}
      }

      this.server = net.createServer((client) => {
        let buffer = "";
        client.on("data", (data) => {
          buffer += data.toString();
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? ""; // Incomplete part stays in buffer

          for (const part of parts) {
            if (part.trim()) {
              try {
                const event = JSON.parse(part);
                this.emit("message", event);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        });
      });

      this.server.on("error", reject);

      this.server.listen(this.socketPath, () => {
        this.env.NF_IPC_SOCKET = this.socketPath;
        resolve(() => {
          this.stop();
        });
      });
    });
  }

  stop() {
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
    const options = args[args.length - 1];
    const env = getWorkspaceEnv(options);

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

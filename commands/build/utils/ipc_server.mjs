import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import pc from "picocolors";
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

const defaultMessageLogger = (msg, group = 'Fastlane') => {
  if (msg.event) {
    process.stdout.write('\r\x1b[K');
    const timeString = new Date().toTimeString().split(' ')[0];
    console.log(`${pc.dim(pc.gray(`(${timeString})`))} ${pc.cyan(`⚡  [${group}]:`)} ${pc.white(msg.event)}`);
    if (msg.payload && Object.keys(msg.payload).length > 0) {
      for (const [key, value] of Object.entries(msg.payload)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
        console.log(`${" ".repeat(16)}${pc.dim((key).padEnd(10, " ") + ":")} ${valStr}`);
      }
    }
  }
}

export class IpcServer extends EventEmitter {
  constructor(env, group = "Fastlane") {
    super();
    this.env = env;
    this.group = group;
    this.noLogs = env.NO_LOGS;
    this.socketPath = path.join(os.tmpdir(), `nf_ipc_${crypto.randomUUID()}.sock`);
    this.server = null;
    this.on('message', (msg) => defaultMessageLogger(msg, this.group))
  }

  async start() {
    if (!this.noLogs) return () => { };
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.socketPath)) {
        try { fs.unlinkSync(this.socketPath); } catch (e) { }
      }

      this.server = net.createServer((client) => {
        let buffer = '';
        client.on('data', (data) => {
          buffer += data.toString();
          const parts = buffer.split('\n');
          buffer = parts.pop(); // Incomplete part stays in buffer

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
        resolve(() => {
          this.server.close();
        })
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
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

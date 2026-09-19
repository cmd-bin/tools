import { taskLog, log } from '@clack/prompts';
import pc from 'picocolors';
import type { TaskEvent } from '../core/types.js';

export interface TaskLoggerOptions {
  spacing?: number;
  limit?: number;
  showLogOnSuccess?: boolean;
  showLogOnError?: boolean;
}

/**
 * Creates an event handler that pipes TaskEvent lifecycle updates to @clack/prompts taskLog instances.
 */
export function createTaskLogger(options: TaskLoggerOptions = {}) {
  const {
    spacing = 0,
    limit,
    showLogOnSuccess = true,
    showLogOnError = true,
  } = options;

  let currentTaskLog: ReturnType<typeof taskLog> | null = null;
  let currentTitle = '';

  return (event: TaskEvent): void => {
    const timeString = new Date().toTimeString().split(' ')[0];
    const prefix = pc.dim(pc.gray(`(${timeString})`)) + ' ';
    switch (event.type) {
      case 'start':
        currentTitle = event.title;
        currentTaskLog = taskLog({
          title: prefix + event.title,
          spacing,
          limit,
        });
        break;
      case 'message':
        if (currentTaskLog) {
          currentTaskLog.message(prefix + event.message);
          for (const [k, v] of Object.entries(event.payload ?? {})) {
            currentTaskLog.message(prefix + `- ${k}: ${v}`);
          }
        } else {
          log.message(prefix + event.message);
          for (const [k, v] of Object.entries(event.payload ?? {})) {
            log.message(prefix + `- ${k}: ${v}`);
          }
        }
        break;
      case 'success': {
        const title = currentTitle || event.message;
        if (currentTaskLog) {
          currentTaskLog.success(prefix + title, { showLog: showLogOnSuccess });
          currentTaskLog = null;
        } else if (title) {
          log.success(prefix + title);
        }
        break;
      }
      case 'error': {
        const title = currentTitle || event.error;
        if (currentTaskLog) {
          currentTaskLog.error(prefix + title, { showLog: showLogOnError });
          currentTaskLog = null;
        } else if (title) {
          log.error(prefix + title);
        }
        break;
      }
    }
  };
}

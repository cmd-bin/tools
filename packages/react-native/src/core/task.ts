import type { TaskEvent, TaskResult } from './types.js';

export interface RunTaskOptions {
  id: string;
  title: string;
  onEvent?: (event: TaskEvent) => void;
}

export type TaskRunnerFn = (log: (message: string) => void) => Promise<string | void>;

/**
 * Executes a single task unit, emitting lifecycle events (start, message, success, error).
 * Returns a TaskResult with the final status and message or error.
 */
export async function runTask(
  options: RunTaskOptions,
  fn: TaskRunnerFn,
): Promise<TaskResult> {
  const { id, title, onEvent } = options;

  onEvent?.({ type: 'start', id, title });

  const log = (message: string) => {
    onEvent?.({ type: 'message', id, message });
  };

  try {
    const msg = await fn(log);
    const resolvedMessage = typeof msg === 'string' ? msg : undefined;
    const result: TaskResult = {
      id,
      title,
      status: 'done',
      message: resolvedMessage,
    };
    onEvent?.({ type: 'success', id, message: resolvedMessage });
    return result;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const result: TaskResult = {
      id,
      title,
      status: 'error',
      error: errorMsg,
    };
    onEvent?.({ type: 'error', id, error: errorMsg });
    return result;
  }
}

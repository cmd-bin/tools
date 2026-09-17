import readline from 'node:readline';
import pc from 'picocolors';

export interface LiveSummarySubItem {
  label: string;
  ok: boolean;
  timeString?: string;
  meta?: Record<string, string | number | boolean | undefined | null>;
  lines?: string[];
  message?: string;
  details?: string;
  hint?: string;
}

export interface LiveSummaryTaskResult {
  ok: boolean;
  /** Short tag, version, or branch shown next to title in parentheses, e.g. "v24.2.0" */
  extra?: string;
  /** Primary message (shown on failure or when present) */
  message?: string;
  /** Optional error details or raw output */
  details?: string;
  /** Optional hint or troubleshooting suggestion */
  hint?: string;
  /**
   * Key-value metadata displayed as nested lines underneath:
   * e.g. { Remote: 'git@github.com:...', Repo: 'appibara/app', Branch: 'main' }
   */
  meta?: Record<string, string | number | boolean | undefined | null>;
  /** Plain text lines displayed underneath */
  lines?: string[];
  /** Sub-tasks or items with their own status indicators */
  subItems?: LiveSummarySubItem[];
  /** Flag indicating task was skipped dynamically */
  skipped?: boolean;
  /** Reason why the task was skipped */
  skipReason?: string;
}

export type LiveSummaryTaskState =
  | 'pending'
  | 'running'
  | 'ok'
  | 'fail'
  | 'skipped';

export interface LiveSummaryTaskContext<TContext = any> {
  onProgress: (message: string) => void;
  skip: (reason?: string) => void;
  context: TContext;
}

export type LiveSummaryTaskRunner<TContext = any> = (
  helpers: LiveSummaryTaskContext<TContext>,
) =>
  | Promise<LiveSummaryTaskResult | boolean | void>
  | LiveSummaryTaskResult
  | boolean
  | void;

export interface LiveSummaryTaskOptions<TContext = any> {
  id?: string;
  title: string;
  run?: LiveSummaryTaskRunner<TContext>;
  enabled?: boolean | ((context: TContext) => boolean);
}

export interface LiveSummaryItemState {
  id: string;
  title: string;
  state: LiveSummaryTaskState;
  runningMessage?: string;
  subStep?: string;
  subStepTimeString?: string;
  triggeredAt?: string;
  result?: LiveSummaryTaskResult;
  run?: LiveSummaryTaskRunner;
  enabled: boolean | ((context: any) => boolean);
}

export interface LiveSummaryOptions<TContext = any> {
  /** Optional section title. If omitted, no title line is rendered. */
  title?: string;
  /** Optional timestamp when title/summary was triggered */
  titleTriggeredAt?: string;
  /** List of task definitions or titles */
  tasks?: Array<LiveSummaryTaskOptions<TContext> | string>;
  /** Spinner frames used during in-progress tasks. Defaults to ['◒', '◐', '◓', '◑'] */
  frames?: string[];
  /** Spinner frame refresh interval in milliseconds. Defaults to 80ms */
  intervalMs?: number;
  /** Shared context object passed to all task runner functions */
  context?: TContext;
}

export function getTimeString(): string {
  return new Date().toTimeString().split(' ')[0];
}

const TIME_PADDING = '           '; // 11 spaces to preserve icon alignment

function formatTimestamp(timeStr?: string): string {
  if (!timeStr) return TIME_PADDING;
  return `${pc.dim(pc.gray(`(${timeStr})`))} `;
}

const DEFAULT_SPINNER_FRAMES = ['◒', '◐', '◓', '◑'];
const ANSI_REGEX = /\x1B\[[0-9;]*[a-zA-Z]/g;

function getVisualRows(
  text: string,
  columns: number = process.stdout.columns || 80,
): number {
  const content = text.endsWith('\n') ? text.slice(0, -1) : text;
  const lines = content.split('\n');
  let rows = 0;
  for (const line of lines) {
    const stripped = line.replace(ANSI_REGEX, '');
    rows += Math.max(1, Math.ceil(stripped.length / columns));
  }
  return rows;
}

function formatWithGuideBar(lines: string[]): string {
  return (
    lines
      .map((line) => (line ? `${pc.gray('│')}  ${line}` : pc.gray('│')))
      .join('\n') + '\n'
  );
}

function appendMeta(
  lines: string[],
  meta?: Record<string, string | number | boolean | undefined | null>,
  indent = `${TIME_PADDING}    `,
) {
  if (!meta) return;
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined && value !== null) {
      lines.push(pc.dim(indent + key + ': ') + pc.cyan(String(value)));
    }
  }
}

function appendSubItems(lines: string[], subItems?: LiveSummarySubItem[]) {
  if (!subItems || subItems.length === 0) return;
  for (const sub of subItems) {
    const icon = sub.ok ? pc.green('✔') : pc.red('✖');
    const hasDetails =
      (sub.lines && sub.lines.length > 0) ||
      (sub.meta && Object.keys(sub.meta).length > 0) ||
      !sub.ok;
    const colon = hasDetails ? ':' : '';
    const timePrefix = formatTimestamp(sub.timeString);
    lines.push(`${timePrefix}    ${icon} ${sub.label}${colon}`);
    for (const line of sub.lines || []) {
      lines.push(pc.dim(`${TIME_PADDING}        ${pc.cyan(line)}`));
    }
    appendMeta(lines, sub.meta, `${TIME_PADDING}        `);
    if (!sub.ok) {
      if (sub.message) lines.push(pc.dim(pc.yellow(`${TIME_PADDING}        ${sub.message}`)));
      if (sub.details)
        lines.push(pc.dim(pc.yellow(`${TIME_PADDING}        Details: ${sub.details}`)));
      if (sub.hint) lines.push(pc.dim(pc.yellow(`${TIME_PADDING}        Hint: ${sub.hint}`)));
    }
  }
}

function appendItemLines(lines: string[], item: LiveSummaryItemState) {
  const result = item.result || { ok: item.state === 'ok' };
  const timePrefix = formatTimestamp(item.triggeredAt);

  if (result.ok) {
    const extra = result.extra ? ` (${result.extra})` : '';
    lines.push(`${timePrefix}${pc.green(`✔  ${item.title}${extra}`)}`);
    appendMeta(lines, result.meta);
    for (const line of result.lines || []) {
      lines.push(pc.dim(`${TIME_PADDING}    ${pc.cyan(line)}`));
    }
    appendSubItems(lines, result.subItems);
    return;
  }

  lines.push(`${timePrefix}${pc.red(`✖  ${item.title}`)}`);
  if (result.message) lines.push(`${TIME_PADDING}    ${result.message}`);
  if (result.details) lines.push(`${TIME_PADDING}    Details: ${result.details}`);
  if (result.hint) lines.push(`${TIME_PADDING}    Hint: ${result.hint}`);
  appendMeta(lines, result.meta);
  for (const line of result.lines || []) {
    lines.push(pc.dim(`${TIME_PADDING}    ${pc.cyan(line)}`));
  }
  appendSubItems(lines, result.subItems);
}

/**
 * Reusable Live Summary with seamless Clack guide-bar rendering (no closed frame).
 */
export class LiveSummary<TContext = any> {
  public title?: string;
  public titleTriggeredAt?: string;
  public readonly frames: string[];
  public readonly intervalMs: number;
  public readonly context: TContext;
  private readonly isTTY: boolean;
  private items: LiveSummaryItemState[];
  private lastRows = 0;
  private frameIndex = 0;
  private timer?: NodeJS.Timeout;

  constructor(options: LiveSummaryOptions<TContext> = {}) {
    this.title = options.title;
    this.titleTriggeredAt =
      options.titleTriggeredAt ||
      (options.title ? getTimeString() : undefined);
    this.frames = options.frames || DEFAULT_SPINNER_FRAMES;
    this.intervalMs = options.intervalMs || 80;
    this.context = options.context || ({} as TContext);
    this.isTTY = Boolean(process.stdout.isTTY);
    this.items = (options.tasks || []).map((task, idx) => {
      if (typeof task === 'string') {
        return {
          id: task,
          title: task,
          state: 'pending',
          enabled: true,
        };
      }
      return {
        id: task.id || task.title || String(idx),
        title: task.title,
        state: 'pending',
        run: task.run,
        enabled: task.enabled ?? true,
      };
    });
  }

  /**
   * Adds a task definition to the summary list.
   */
  public addTask(task: LiveSummaryTaskOptions<TContext> | string): this {
    if (typeof task === 'string') {
      this.items.push({
        id: task,
        title: task,
        state: 'pending',
        enabled: true,
      });
    } else {
      this.items.push({
        id: task.id || task.title || String(this.items.length),
        title: task.title,
        state: 'pending',
        run: task.run,
        enabled: task.enabled ?? true,
      });
    }
    return this;
  }

  /**
   * Starts live rendering. Immediately prints the initial skeleton list and begins spinner interval.
   */
  public start(): this {
    if (this.isTTY) {
      this.render();
      this.timer = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        this.render();
      }, this.intervalMs);
      this.timer.unref?.();
    }
    return this;
  }

  /**
   * Force re-renders the live list in place.
   */
  public update(): void {
    if (this.isTTY) {
      this.render();
    }
  }

  /**
   * Updates the pipeline summary title dynamically.
   */
  public setTitle(title: string, triggeredAt?: string): void {
    this.title = title;
    if (triggeredAt) {
      this.titleTriggeredAt = triggeredAt;
    } else if (!this.titleTriggeredAt) {
      this.titleTriggeredAt = getTimeString();
    }
    this.update();
  }

  /**
   * Runs an individual task by title or id.
   */
  public async run(
    titleOrId: string,
    runner?: LiveSummaryTaskRunner<TContext>,
  ): Promise<LiveSummaryTaskResult> {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (!item) {
      throw new Error(`LiveSummary task not found: ${titleOrId}`);
    }

    const isEnabled =
      typeof item.enabled === 'function'
        ? item.enabled(this.context)
        : item.enabled;

    if (!isEnabled) {
      item.state = 'skipped';
      this.update();
      return { ok: true, skipped: true };
    }

    const taskFn = runner || item.run;
    if (!taskFn) {
      throw new Error(
        `LiveSummary task "${titleOrId}" has no runner function provided.`,
      );
    }

    if (!item.triggeredAt) {
      item.triggeredAt = getTimeString();
    }
    item.state = 'running';
    this.update();

    let isSkipped = false;
    let skipReason: string | undefined;

    const helpers: LiveSummaryTaskContext<TContext> = {
      onProgress: (message: string) => {
        item.runningMessage = message;
        this.update();
      },
      skip: (reason?: string) => {
        isSkipped = true;
        skipReason = reason;
      },
      context: this.context,
    };

    try {
      const output = await taskFn(helpers);
      item.runningMessage = undefined;

      if (isSkipped) {
        item.state = 'skipped';
        item.runningMessage = skipReason;
        this.update();
        return { ok: true, skipped: true, skipReason };
      }

      let result: LiveSummaryTaskResult;
      if (typeof output === 'boolean') {
        result = { ok: output };
      } else if (!output) {
        result = { ok: true };
      } else {
        result = output;
      }

      if (result.skipped) {
        item.state = 'skipped';
        item.runningMessage = result.skipReason || result.message;
      } else {
        item.result = result;
        item.state = result.ok ? 'ok' : 'fail';
      }

      this.update();
      return result;
    } catch (error: any) {
      const result: LiveSummaryTaskResult = {
        ok: false,
        message: error.message || String(error),
      };
      item.result = result;
      item.state = 'fail';
      item.runningMessage = undefined;
      this.update();
      return result;
    }
  }

  /**
   * Skips a task with an optional reason.
   */
  public skip(titleOrId: string, reason?: string): void {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (item) {
      if (!item.triggeredAt) {
        item.triggeredAt = getTimeString();
      }
      item.state = 'skipped';
      item.runningMessage = reason;
      this.update();
    }
  }

  /**
   * Updates an item's state or properties directly and re-renders.
   */
  public updateItem(
    titleOrId: string,
    updates: Partial<LiveSummaryItemState>,
  ): void {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (!item) return;

    if (
      updates.state &&
      updates.state !== 'pending' &&
      !item.triggeredAt &&
      !updates.triggeredAt
    ) {
      item.triggeredAt = getTimeString();
    }

    Object.assign(item, updates);
    this.update();
  }

  /**
   * Adds or updates a sub-item under a parent item.
   */
  public addOrUpdateSubItem(
    titleOrId: string,
    subItem: LiveSummarySubItem,
  ): void {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (!item) return;

    if (!subItem.timeString) {
      subItem.timeString = getTimeString();
    }

    if (!item.result) {
      item.result = { ok: true, subItems: [] };
    }
    if (!item.result.subItems) {
      item.result.subItems = [];
    }

    const existingIdx = item.result.subItems.findIndex(
      (s) => s.label === subItem.label,
    );
    if (existingIdx >= 0) {
      item.result.subItems[existingIdx] = {
        ...item.result.subItems[existingIdx],
        ...subItem,
      };
    } else {
      item.result.subItems.push(subItem);
    }

    this.update();
  }

  /**
   * Sets the active in-progress sub-step message for an item.
   */
  public setSubStep(titleOrId: string, subStepMessage?: string): void {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (!item) return;

    item.subStep = subStepMessage;
    item.subStepTimeString = subStepMessage ? getTimeString() : undefined;
    this.update();
  }

  /**
   * Merges metadata key-values into an item's result.
   */
  public setMeta(
    titleOrId: string,
    meta: Record<string, string | number | boolean | undefined | null>,
  ): void {
    const item = this.items.find(
      (i) => i.id === titleOrId || i.title === titleOrId,
    );
    if (!item) return;

    if (!item.result) {
      item.result = { ok: true, meta: {} };
    }
    item.result.meta = {
      ...(item.result.meta || {}),
      ...meta,
    };
    this.update();
  }

  /**
   * Executes all registered tasks sequentially.
   */
  public async runAll(): Promise<boolean> {
    this.start();
    for (const item of this.items) {
      if (item.run) {
        await this.run(item.id);
      }
    }
    this.stop();
    return this.isSuccess();
  }

  /**
   * Stops the live spinner and renders the final complete output.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.isTTY) {
      this.render();
    } else {
      process.stdout.write(this.buildContent());
    }
  }

  /**
   * Returns true if all active tasks completed with ok or skipped.
   */
  public isSuccess(): boolean {
    return this.items.every((i) => i.state === 'ok' || i.state === 'skipped');
  }

  /**
   * Returns all items that failed.
   */
  public getFailures(): LiveSummaryItemState[] {
    return this.items.filter((i) => i.state === 'fail');
  }

  /**
   * Returns item state by title or ID.
   */
  public getItem(titleOrId: string): LiveSummaryItemState | undefined {
    return this.items.find((i) => i.id === titleOrId || i.title === titleOrId);
  }

  /**
   * Returns all items.
   */
  public getItems(): LiveSummaryItemState[] {
    return [...this.items];
  }

  /**
   * Returns the raw unadorned lines for each item.
   */
  public buildLines(): string[] {
    const lines: string[] = [];
    const spinnerIcon = pc.cyan(this.frames[this.frameIndex]);

    for (const item of this.items) {
      if (item.state === 'pending') {
        const timePrefix = formatTimestamp(item.triggeredAt);
        lines.push(`${timePrefix}${pc.dim(`○  ${item.title}`)}`);
      } else if (item.state === 'running') {
        const timePrefix = formatTimestamp(item.triggeredAt || getTimeString());
        const detail = item.runningMessage
          ? pc.dim(` (${item.runningMessage})`)
          : '';
        lines.push(`${timePrefix}${spinnerIcon}  ${item.title}${detail}`);
        if (item.result) {
          appendMeta(lines, item.result.meta);
          for (const line of item.result.lines || []) {
            lines.push(pc.dim(`${TIME_PADDING}    ${pc.cyan(line)}`));
          }
          appendSubItems(lines, item.result.subItems);
        }
        if (item.subStep) {
          const subStepTime = formatTimestamp(
            item.subStepTimeString || item.triggeredAt || getTimeString(),
          );
          lines.push(`${subStepTime}    ${spinnerIcon} ${item.subStep}`);
        }
      } else if (item.state === 'skipped') {
        const timePrefix = formatTimestamp(item.triggeredAt);
        const detail = item.runningMessage
          ? ` (${item.runningMessage})`
          : ' (skipped)';
        lines.push(`${timePrefix}${pc.dim(`⊘  ${item.title}${detail}`)}`);
      } else {
        appendItemLines(lines, item);
      }
    }

    return lines;
  }

  /**
   * Generates the formatted text content connected with Clack's guide bar.
   */
  public buildContent(): string {
    const formatted = formatWithGuideBar(this.buildLines());
    if (this.title) {
      if (!this.titleTriggeredAt) {
        this.titleTriggeredAt = getTimeString();
      }
      const timePrefix = `${pc.dim(pc.gray(`(${this.titleTriggeredAt})`))} `;
      return `${pc.gray('│')}\n${pc.cyan('◇')}  ${timePrefix}${pc.bold(this.title)}\n${pc.gray('│')}\n${formatted}`;
    }
    return formatted;
  }

  private render(): void {
    const text = this.buildContent();

    if (this.lastRows > 0) {
      readline.cursorTo(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -this.lastRows);
      readline.clearScreenDown(process.stdout);
    }

    process.stdout.write(text);
    this.lastRows = getVisualRows(text);
  }
}

/**
 * Creates a new LiveSummary instance.
 */
export function createLiveSummary<TContext = any>(
  options: LiveSummaryOptions<TContext> = {},
): LiveSummary<TContext> {
  return new LiveSummary<TContext>(options);
}

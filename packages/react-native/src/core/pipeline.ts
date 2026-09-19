import { EventEmitter } from 'node:events';
import { spawnProcess } from '../utils/process.js';
import { clearBuilds } from '../utils/clear_builds.js';
import { CoreIpcServer } from './ipc.js';
import {
  DEFAULT_PIPELINE_STEPS,
  type PipelineEvent,
  type PipelineStepDef,
} from './types.js';

export interface PipelineRunOptions {
  clean?: boolean;
  production?: boolean;
  [key: string]: any;
}

export async function runPipelineCore(
  args: string[],
  options: PipelineRunOptions = {},
  onEvent?: (event: PipelineEvent) => void,
): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;
  const env = (globalThis._constants.ENV || process.env) as Record<
    string,
    string | boolean | undefined
  >;

  const emit = (event: PipelineEvent) => {
    onEvent?.(event);
  };

  // 1. Clean if requested
  if (options.clean) {
    const isAndroid = args[0] === 'android';
    await clearBuilds(isAndroid ? 'android' : 'ios');
  }

  // 2. Check bundle gems
  const bundleStart = performance.now();
  emit({ type: 'bundle_checking' });

  try {
    const code = await spawnProcess('bundle', ['check'], {
      cwd: fastlaneDir,
      stdio: 'ignore',
      env,
    });

    if (code === 0) {
      emit({
        type: 'bundle_ready',
        durationMs: performance.now() - bundleStart,
      });
    } else {
      emit({ type: 'bundle_installing' });
      const installCode = await spawnProcess('bundle', ['install'], {
        cwd: fastlaneDir,
        stdio: env.NO_LOGS ? 'ignore' : 'inherit',
        env,
      });
      if (installCode !== 0) {
        throw new Error(`bundle install exited with code ${installCode}`);
      }
      emit({
        type: 'bundle_ready',
        durationMs: performance.now() - bundleStart,
      });
    }
  } catch (err: any) {
    emit({ type: 'bundle_error', error: err.message });
    return { ok: false, durationMs: performance.now() - bundleStart, error: err.message };
  }

  // 3. Start IPC Server
  const ipcServer = new CoreIpcServer();
  let stopIpc: (() => void) | null = null;
  stopIpc = await ipcServer.start();
  globalThis._constants.IPC_SERVER_STOP = stopIpc;

  emit({
    type: 'pipeline_init',
    steps: DEFAULT_PIPELINE_STEPS.filter((s) => s.id !== 'install'),
  });

  let activeStep: string | null = null;

  ipcServer.on('message', (msg: any) => {
    if (msg.event === 'pipeline_init') {
      const rawSteps = Array.isArray(msg.payload?.steps)
        ? (msg.payload!.steps as Array<string | PipelineStepDef>)
        : undefined;
      const title =
        typeof msg.payload?.title === 'string' ? msg.payload.title : undefined;

      let tasks: PipelineStepDef[];
      if (rawSteps && rawSteps.length > 0) {
        tasks = rawSteps.map((s) => {
          if (typeof s === 'string') {
            const def = DEFAULT_PIPELINE_STEPS.find((d) => d.id === s);
            return def || { id: s, title: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') };
          }
          return { id: String(s.id), title: String(s.title) };
        });
      } else {
        tasks = DEFAULT_PIPELINE_STEPS.filter((s) => s.id !== 'install');
      }

      emit({ type: 'pipeline_init', steps: tasks, title });
      return;
    }

    if (msg.event === 'pipeline_step_start') {
      const stepId = String(msg.payload?.step || '');
      activeStep = stepId;
      emit({
        type: 'step_start',
        stepId,
        timeString: new Date().toTimeString().split(' ')[0],
      });
      return;
    }

    if (msg.event === 'pipeline_step_end') {
      const stepId = String(msg.payload?.step || activeStep || '');
      emit({
        type: 'step_end',
        stepId,
        duration: msg.payload?.duration,
      });
      if (activeStep === stepId) activeStep = null;
      return;
    }

    if (msg.event === 'pipeline_step_fail') {
      const stepId = String(msg.payload?.step || activeStep || '');
      emit({
        type: 'step_fail',
        stepId,
        error: msg.payload?.error,
      });
      if (activeStep === stepId) activeStep = null;
      return;
    }
  });

  // 4. Run fastlane process
  const fastlaneStart = performance.now();
  let ok = false;
  let errorMsg: string | undefined;

  try {
    const exitCode = (await spawnProcess(
      'bundle',
      ['exec', 'fastlane', ...args],
      {
        cwd: fastlaneDir,
        stdio: env.NO_LOGS ? 'ignore' : 'inherit',
        env,
      },
    )) as number;

    ok = exitCode === 0;
    if (!ok) {
      process.exitCode = exitCode;
      errorMsg = `Fastlane process exited with code ${exitCode}`;
    }
  } catch (err: any) {
    ok = false;
    process.exitCode = 1;
    errorMsg = err.message;
  } finally {
    stopIpc?.();
    const durationMs = performance.now() - fastlaneStart;
    emit({
      type: 'pipeline_finish',
      ok,
      durationMs,
      error: errorMsg,
    });
    return { ok, durationMs, error: errorMsg };
  }
}

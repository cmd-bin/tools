import { getWorkspaceEnv } from './workspace_env.js';
import { spawnProcess, registerProcessSignals } from './process.js';
import pc from 'picocolors';
import path from 'node:path';
// import { IpcServer } from "../../utils/ipc_server.js";
import { formatDuration } from './logger.js';
import { ensureRubyEnvironment } from './ruby.js';
import { spinner, log } from '@clack/prompts';
import { spawnSync } from 'node:child_process';

const Spinner = spinner();

export async function run(
  command: string,
  args: string[],
  env: Record<string, string | boolean | undefined>,
  cwd: string | null = null,
) {
  const code = (await spawnProcess(command, args, {
    cwd: cwd ?? env.FASTLANE_DIR,
    stdio: env.NO_LOGS ? 'ignore' : 'pipe',
    env,
  })) as number;
  if (code !== 0) process.exit(code);
}

export async function runFastlane(
  fastlaneArgs: string[],
  env: Record<string, string | boolean | undefined>,
) {
  if (fastlaneArgs.length === 0)
    throw new Error(
      'Fastlane arguments are required. Example: actions ios adhoc',
    );

  await run('bundle', ['exec', 'fastlane', ...fastlaneArgs], env);
}

export async function runBundle(
  bundleArgs: string[],
  options: Record<string, string | boolean | undefined>,
) {
  const baseEnv = getWorkspaceEnv(options);
  const env = await ensureRubyEnvironment(
    baseEnv as Record<string, string | undefined>,
  );
  await run('bundle', bundleArgs, env);
}

async function checkBundle(
  baseEnv: Record<string, string | boolean | undefined>,
) {
  try {
    const env = await ensureRubyEnvironment(
      getWorkspaceEnv(baseEnv) as Record<string, string | undefined>,
    );
    const code = await spawnProcess('bundle', ['check'], {
      cwd: env.FASTLANE_DIR,
      stdio: 'ignore',
      env,
    });
    return code === 0;
  } catch {
    return false;
  }
}
let cleanupCalled = false;
export async function runCommand(
  args: string[],
  options: Record<string, string | boolean | undefined>,
) {
  const baseEnv = getWorkspaceEnv(options);
  const env = await ensureRubyEnvironment(
    baseEnv as Record<string, string | undefined>,
  );

  // const ipcServer = new IpcServer(env);
  // const stopServer = (await ipcServer.start()) as () => void;
  const cleanup: ((_?: boolean) => void)[] = [];
  const cleanupServerListeners = registerProcessSignals(() => {
    if (cleanupCalled) return;
    cleanup.forEach((fn) => fn?.(false));
    cleanupCalled = true;
  });

  try {
    let timeString = new Date().toTimeString().split(' ')[0];
    let startTimer = performance.now();
    Spinner.start(
      pc.dim(pc.gray(`(${timeString})`)) + ' 📦' + ' Bundle gem check',
    );

    const isBundleReady = await checkBundle(env);
    timeString = new Date().toTimeString().split(' ')[0];
    // let [duration, stopFn, Spinner] = stopAnim();

    if (isBundleReady) {
      Spinner.stop(
        pc.dim(pc.gray(`(${timeString})`)) +
          ' ' +
          pc.green(
            `✅  Bundle gems are ready. (${pc.bold(formatDuration(performance.now() - startTimer))})`,
          ),
      );
    } else if (!isBundleReady) {
      timeString = new Date().toTimeString().split(' ')[0];
      Spinner.message(
        pc.dim(pc.gray(`(${timeString})`)) + ' 📦' + ` Bundle gem install`,
      );
      startTimer = performance.now();
      await run('bundle', ['install'], env);
      timeString = new Date().toTimeString().split(' ')[0];
      Spinner.stop(
        pc.dim(pc.gray(`(${timeString})`)) +
          ' ' +
          pc.green(
            `✅  Bundle gem install completed. (${pc.bold(formatDuration(performance.now() - startTimer))})`,
          ),
      );
    }

    // Print the actual Ruby being used so the user can verify
    const rubyPathCheck = spawnSync('which', ['ruby'], {
      env: env as NodeJS.ProcessEnv,
      encoding: 'utf-8',
    }).stdout.trim();
    log.info(pc.cyan(`🔍  Using Ruby at: ${rubyPathCheck}`));

    timeString = new Date().toTimeString().split(' ')[0];
    log.info(
      pc.dim(pc.gray(`(${timeString})`)) +
        ' ' +
        '🚀  [Fastlane]: process started',
    );
    const fastlaneStartTime = performance.now();

    await runFastlane(args, env);
    // [duration, stopFn] = stopAnim();
    timeString = new Date().toTimeString().split(' ')[0];
    log.success(
      pc.dim(pc.gray(`(${timeString})`)) +
        ' ' +
        pc.green(
          `✅  Fastlane process completed. (${pc.bold(formatDuration(performance.now() - fastlaneStartTime))})`,
        ),
    );
  } finally {
    // stopServer();
    cleanupServerListeners();
  }
}

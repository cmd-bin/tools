import { spawnProcess, registerProcessSignals } from './process.js';
import pc from 'picocolors';
import { formatDuration } from './logger.js';
import { spinner, log } from '@clack/prompts';

const Spinner = spinner();

export async function exec(
  command: string,
  args: string[],
  cwd: string | null = null,
) {
  const env = globalThis._constants.ENV as Record<
    string,
    string | boolean | undefined
  >;
  const code = (await spawnProcess(command, args, {
    cwd: cwd ?? globalThis._constants.FASTLANE_DIR,
    stdio: env.NO_LOGS ? 'ignore' : 'pipe',
    env,
  })) as number;
  if (code !== 0) process.exit(code);
}

async function checkBundle() {
  const env = globalThis._constants.ENV as Record<
    string,
    string | boolean | undefined
  >;
  try {
    const code = await spawnProcess('bundle', ['check'], {
      cwd: globalThis._constants.FASTLANE_DIR,
      stdio: 'ignore',
      env,
    });
    return code === 0;
  } catch {
    return false;
  }
}

let cleanupCalled = false;

export async function executeFastlane(
  args: string[],
  options?: Record<string, string | boolean | undefined>,
) {
  if (args.length === 0) {
    throw new Error('Fastlane arguments are required. Example: ios adhoc');
  }

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

    const isBundleReady = await checkBundle();
    timeString = new Date().toTimeString().split(' ')[0];

    if (isBundleReady) {
      Spinner.stop(
        pc.dim(pc.gray(`(${timeString})`)) +
          ' ' +
          pc.green(
            `✅  Bundle gems are ready. (${pc.bold(formatDuration(performance.now() - startTimer))})`,
          ),
      );
    } else {
      timeString = new Date().toTimeString().split(' ')[0];
      Spinner.message(
        pc.dim(pc.gray(`(${timeString})`)) + ' 📦' + ' Bundle gem install',
      );
      startTimer = performance.now();
      await exec('bundle', ['install']);
      timeString = new Date().toTimeString().split(' ')[0];
      Spinner.stop(
        pc.dim(pc.gray(`(${timeString})`)) +
          ' ' +
          pc.green(
            `✅  Bundle gem install completed. (${pc.bold(formatDuration(performance.now() - startTimer))})`,
          ),
      );
    }

    timeString = new Date().toTimeString().split(' ')[0];
    // log.info(
    //   pc.dim(pc.gray(`(${timeString})`)) +
    //     ' ' +
    //     '🚀  [Fastlane]: process started',
    // );
    const fastlaneStartTime = performance.now();

    await exec('bundle', ['exec', 'fastlane', ...args]);

    timeString = new Date().toTimeString().split(' ')[0];
    log.success(
      pc.dim(pc.gray(`(${timeString})`)) +
        ' ' +
        pc.green(
          `✅  Completed. (${pc.bold(formatDuration(performance.now() - fastlaneStartTime))})`,
        ),
    );
  } finally {
    cleanupServerListeners();
  }
}

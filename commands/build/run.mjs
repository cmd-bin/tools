import { getWorkspaceEnv } from "./workspace_env.mjs";
import { spawnProcess, registerProcessSignals } from "./utils/process.mjs";
import pc from "picocolors";
import path from "node:path";
import { IpcServer } from './utils/ipc_server.mjs';
import { startLog } from "./utils/logger.mjs";

export async function run(command, args, env, cwd = null) {
  const code = await spawnProcess(command, args, { cwd: cwd ?? env.FASTLANE_DIR, stdio: env.NO_LOGS ? "ignore" : "inherit", env });
  if (code !== 0) process.exit(code);
}

export async function runFastlane(fastlaneArgs, env) {
  if (fastlaneArgs.length === 0) throw new Error("Fastlane arguments are required. Example: actions ios adhoc");

  await run("bundle", ["exec", "fastlane", ...fastlaneArgs], env);
}

export async function runBundle(bundleArgs, options) {
  const env = getWorkspaceEnv(options);
  await run("bundle", bundleArgs, env, path.resolve(env.CALLER_WORKSPACE, 'ios'));
}

async function checkBundle(env) {
  try {
    const code = await spawnProcess("bundle", ["check"], { cwd: env.FASTLANE_DIR, stdio: env.NO_LOGS ? "ignore" : "inherit", env });
    return code === 0;
  } catch {
    return false;
  }
}
let cleanupCalled = false
export async function runCommand(args, options) {
  const env = getWorkspaceEnv(options);
  const logProcess = (text) => startLog(text, env.NO_LOGS);

  const ipcServer = new IpcServer(env);
  const stopServer = await ipcServer.start();
  const cleanup = [stopServer];
  const cleanupServerListeners = registerProcessSignals(() => {
    if (cleanupCalled) return;
    cleanup.forEach(fn => fn?.(false))
    cleanupCalled = true;
  });

  try {
    let stopAnim = logProcess('📦  Bundle gem check');
    cleanup.unshift(stopAnim)
    const isBundleReady = await checkBundle(env);
    cleanup.splice(cleanup.indexOf(stopAnim), 1)
    let duration = stopAnim();

    if (!isBundleReady) {
      stopAnim = logProcess('📦  Bundle gem install');
      cleanup.unshift(stopAnim)
      await run("bundle", ["install"], env);
      cleanup.splice(cleanup.indexOf(stopAnim), 1)
      duration = stopAnim();
      const timeString = new Date().toTimeString().split(' ')[0];
      console.log(pc.dim(pc.gray(`(${timeString})`)) + " " + pc.green(`✅  Bundle gem install completed. (${pc.bold(duration)})`));
    } else {
      const timeString = new Date().toTimeString().split(' ')[0];
      console.log(pc.dim(pc.gray(`(${timeString})`)) + " " + pc.green(`✅  Bundle gems are ready. (${pc.bold(duration)})`));
    }

    stopAnim = logProcess('🚀  [Fastlane]: process');
    cleanup.unshift(stopAnim)
    await runFastlane(args, env);
    cleanup.splice(cleanup.indexOf(stopAnim), 1)
    duration = stopAnim();
    const timeString = new Date().toTimeString().split(' ')[0];
    console.log(pc.dim(pc.gray(`(${timeString})`)) + " " + pc.green(`✅  Fastlane process completed. (${pc.bold(duration)})`));
  } finally {
    stopServer();
    cleanupServerListeners();
  }
}

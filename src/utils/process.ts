import { spawn } from "node:child_process";
import { S } from "./ipc_server.js";

export function registerProcessSignals(cleanupFn: () => void) {
  process.on("exit", cleanupFn);
  process.on("SIGINT", cleanupFn);
  process.on("SIGTERM", cleanupFn);

  return () => {
    process.removeListener("exit", cleanupFn);
    process.removeListener("SIGINT", cleanupFn);
    process.removeListener("SIGTERM", cleanupFn);
  };
}

export async function spawnProcess(
  command: string,
  args: string[],
  options = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    const killChild = () => {
      S.clear();
      if (!child.killed) child.kill("SIGTERM");
    };

    const cleanupListeners = registerProcessSignals(killChild);

    child.on("error", (err) => {
      S.error(err.message);
      cleanupListeners();
      reject(err);
    });

    child.on("exit", (code) => {
      if (code !== 0) S.error(`Process exited with code ${code}`);
      cleanupListeners();
      resolve(code);
    });
  });
}

function isTruthyEnv(val: string | undefined | null) {
  if (val === undefined || val === null) return false;
  const clean = val.trim().toLowerCase();
  return (
    clean !== "" &&
    clean !== "false" &&
    clean !== "0" &&
    clean !== "off" &&
    clean !== "no"
  );
}

export function isCi() {
  const ci = process.env.CI;

  // If CI is explicitly set to a disabled/falsy state, override and return false
  if (ci !== undefined && !isTruthyEnv(ci)) {
    return false;
  }

  // If CI is set and truthy, return true
  if (isTruthyEnv(ci)) return true;

  // Check other common CI env variables
  const ciIndicators = [
    "GITHUB_ACTIONS",
    "JENKINS_URL",
    "TRAVIS",
    "CIRCLECI",
    "GITLAB_CI",
    "BITRISE_IO",
    "TF_BUILD",
    "BUDDY",
    "APPVEYOR",
  ];

  return ciIndicators.some((key) => isTruthyEnv(process.env[key]));
}

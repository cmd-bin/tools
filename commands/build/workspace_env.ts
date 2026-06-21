import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const githubRepoPattern = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const callerWorkspace = process.cwd();
const fastlaneDir = path.resolve(__dirname, "..", "fastlane");

const envCache = new Map();

export function getWorkspaceEnv(options: Record<string, unknown> = {}) {
  const execOptions = { cwd: callerWorkspace };
  const remoteOriginUrl = execSync(
    "git config --get remote.origin.url",
    execOptions,
  )
    .toString()
    .trim();
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", execOptions)
    .toString()
    .trim();

  const githubRepositoryMatch = remoteOriginUrl.match(githubRepoPattern)?.[1];
  const cacheKey = JSON.stringify(options);
  if (envCache.has(cacheKey)) {
    return envCache.get(cacheKey);
  }

  const buildType = options.production ? "PROD" : "DEV";

  const env = {
    // Default Fastlane environment variables
    ...process.env,
    BUILD_ENVIRONMENT: options.production ? "production" : "development",
    SCHEME: process.env.SCHEME || process.env[`SCHEME_${buildType}`],
    BEFORE_ALL:
      process.env.BEFORE_ALL || process.env[`BEFORE_ALL_${buildType}`],
    WORKSPACE_NAME:
      process.env.WORKSPACE_NAME || process.env[`WORKSPACE_NAME_${buildType}`],
    APP_IDENTIFIER:
      process.env.APP_IDENTIFIER || process.env[`APP_IDENTIFIER_${buildType}`],
    FIREBASE_IOS_APP_ID:
      process.env.FIREBASE_IOS_APP_ID ||
      process.env[`FIREBASE_IOS_APP_ID_${buildType}`],
    FIREBASE_CREDENTIALS:
      process.env.FIREBASE_CREDENTIALS ||
      process.env[`FIREBASE_CREDENTIALS_${buildType}`],
    FIREBASE_ANDROID_APP_ID:
      process.env.FIREBASE_ANDROID_APP_ID ||
      process.env[`FIREBASE_ANDROID_APP_ID_${buildType}`],
    GITHUB_REF_NAME: process.env.GITHUB_REF_NAME || currentBranch,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || githubRepositoryMatch,
    GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE || callerWorkspace,
    WORKSPACE_PATH: process.env.WORKSPACE_PATH || `${callerWorkspace}/ios`,
    ANDROID_PROJECT_PATH:
      process.env.ANDROID_PROJECT_PATH || `${callerWorkspace}/android`,

    BUNDLE_GEMFILE:
      process.env.BUNDLE_GEMFILE || path.join(fastlaneDir, "Gemfile"),
    BUNDLE_PATH:
      process.env.BUNDLE_PATH || path.join(callerWorkspace, "vendor", "bundle"),
    BUNDLE_FORCE_RUBY_PLATFORM:
      process.env.BUNDLE_FORCE_RUBY_PLATFORM || "true",
    FASTLANE_FASTFILE: path.join(fastlaneDir, "Fastfile"),

    // Scripts environment variables
    CALLER_WORKSPACE: callerWorkspace,
    FASTLANE_DIR: fastlaneDir,
    NO_LOGS: process.env.NO_LOGS !== "false",
    KEEP_OUTPUTS: process.env.KEEP_OUTPUTS === "true",

    // Flags for build steps
    USE_FRAMEWORKS: process.env.USE_FRAMEWORKS || "static",
  };

  envCache.set(cacheKey, env);
  return env;
}

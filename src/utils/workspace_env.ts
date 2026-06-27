import { execSync } from "node:child_process";
import path from "node:path";

type ENV = Record<string, string> & {
  BUILD_ENVIRONMENT: string;
  SCHEME: string;
  BEFORE_ALL: string;
  WORKSPACE_NAME: string;
  APP_IDENTIFIER: string;
  FIREBASE_IOS_APP_ID: string;
  FIREBASE_CREDENTIALS: string;
  FIREBASE_ANDROID_APP_ID: string;
  GITHUB_REF_NAME: string;
  GITHUB_REPOSITORY: string;
  GITHUB_WORKSPACE: string;
  WORKSPACE_PATH: string;
  ANDROID_PROJECT_PATH: string;

  BUNDLE_GEMFILE: string;
  BUNDLE_PATH: string;
  BUNDLE_FORCE_RUBY_PLATFORM: string;
  FASTLANE_FASTFILE: string;
  FASTLANE_HIDE_PLUGINS_TABLE: boolean;

  // Scripts environment variables
  CALLER_WORKSPACE: string;
  FASTLANE_DIR: string;
  NO_LOGS: boolean;
  KEEP_OUTPUTS: boolean;

  // Flags for build steps
  USE_FRAMEWORKS: string;
};

let WORKSPACE_ENV: ENV | null = null;
export function getWorkspaceEnv(options: Record<string, unknown> = {}): ENV {
  if (WORKSPACE_ENV) return WORKSPACE_ENV;

  const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;
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

  const githubRepository = remoteOriginUrl.match(
    globalThis._constants.GITHUB_REPO_PATTERN,
  )?.[2];

  if (!githubRepository)
    throw new Error("Failed to get repository name from remote origin url");

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
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || githubRepository,
    GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE || callerWorkspace,
    WORKSPACE_PATH:
      process.env.WORKSPACE_PATH || path.join(callerWorkspace, "ios"),
    ANDROID_PROJECT_PATH:
      process.env.ANDROID_PROJECT_PATH || path.join(callerWorkspace, "android"),

    BUNDLE_GEMFILE:
      process.env.BUNDLE_GEMFILE || path.join(fastlaneDir, "Gemfile"),
    BUNDLE_PATH:
      process.env.BUNDLE_PATH || path.join(fastlaneDir, "vendor", "bundle"),
    BUNDLE_FORCE_RUBY_PLATFORM:
      process.env.BUNDLE_FORCE_RUBY_PLATFORM || "true",
    FASTLANE_FASTFILE: path.join(fastlaneDir, "Fastfile"),

    // Scripts environment variables
    CALLER_WORKSPACE: callerWorkspace,
    FASTLANE_DIR: fastlaneDir,
    FASTLANE_HIDE_PLUGINS_TABLE: true,
    NO_LOGS: process.env.NO_LOGS !== "false",
    KEEP_OUTPUTS: process.env.KEEP_OUTPUTS === "true",

    // Flags for build steps
    USE_FRAMEWORKS: process.env.USE_FRAMEWORKS || "static",
  } as ENV;

  WORKSPACE_ENV = env;

  return env;
}

import {
  hasAndroidProject,
  getAndroidIdentifiers,
  type ResolveAndroidIdentifiersResult,
} from '../android.js';
import {
  hasIosProject,
  getIosIdentifiers,
  type ResolveIosBundleIdentifiersResult,
} from '../xcode.js';
import { resolveGitContext } from './git.js';
import { resolveEnvWithFallback } from './fallback.js';
import { resolveToolingPaths } from './paths.js';
import type { BuildType, ENV, GetWorkspaceEnvOptions } from './types.js';
import { loadDeployEnv } from './load_deploy_env.js';
import { ensureRubyEnvironment } from '../ruby.js';

export * from './types.js';
export * from './git.js';
export * from './fallback.js';
export * from './paths.js';
export * from './load_deploy_env.js';

export async function getWorkspaceEnv(
  _args: Array<string> = [],
  options: GetWorkspaceEnvOptions = {},
): Promise<ENV> {
  if (globalThis._constants.ENV) return globalThis._constants.ENV;

  const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;

  // 1. Resolve Git Context
  const gitContext = resolveGitContext(callerWorkspace);

  // 2. Build Type
  const isProduction = Boolean(options.production);
  const buildType: BuildType = isProduction ? 'PROD' : 'DEV';

  // 3. Resolve Platform Identifiers
  const hasAndroid = hasAndroidProject(callerWorkspace);
  const hasIos = hasIosProject(callerWorkspace);

  let androidInfo: ResolveAndroidIdentifiersResult | null = null;
  let appIdentifierAndroid: string | null = null;
  if (hasAndroid) {
    try {
      androidInfo = getAndroidIdentifiers({
        workspaceRoot: callerWorkspace,
        production: isProduction,
      });
      appIdentifierAndroid = androidInfo.applicationId;
    } catch {
      // Ignore parsing errors and fallback to env
    }
  }
  if (!appIdentifierAndroid) {
    appIdentifierAndroid =
      resolveEnvWithFallback('APP_IDENTIFIER_ANDROID', buildType) ||
      resolveEnvWithFallback('APP_IDENTIFIER', buildType) ||
      null;
  }

  let iosInfo: ResolveIosBundleIdentifiersResult | null = null;
  let appIdentifierIos: string | null = null;
  let iosTargetMapJson: string | null = null;
  if (hasIos) {
    try {
      iosInfo = getIosIdentifiers({
        workspaceRoot: callerWorkspace,
        production: isProduction,
        scheme: options.scheme ? String(options.scheme) : undefined,
        workspaceName: options.workspaceName
          ? String(options.workspaceName)
          : undefined,
        configuration: options.configuration
          ? String(options.configuration)
          : undefined,
      });
      appIdentifierIos = iosInfo.bundle_id;
      if (iosInfo.targets && iosInfo.targets.length > 0) {
        iosTargetMapJson = JSON.stringify(iosInfo.targets);
      }
    } catch {
      // Ignore parsing errors and fallback to env
    }
  }
  if (!appIdentifierIos) {
    appIdentifierIos =
      resolveEnvWithFallback('APP_IDENTIFIER_IOS', buildType) ||
      resolveEnvWithFallback('APP_IDENTIFIER', buildType) ||
      null;
  }

  // 4. If neither Android nor iOS project is found and no identifiers exist, then fail
  if (!hasAndroid && !hasIos && !appIdentifierAndroid && !appIdentifierIos) {
    throw new Error(
      `Neither iOS nor Android project was found (${callerWorkspace}).`,
    );
  }

  // 5. Sync to process.env
  if (appIdentifierAndroid) {
    process.env.APP_IDENTIFIER_ANDROID = appIdentifierAndroid;
  }
  if (appIdentifierIos) {
    process.env.APP_IDENTIFIER_IOS = appIdentifierIos;
  }
  if (iosTargetMapJson) {
    process.env.IOS_TARGET_IDENTIFIER_MAP = iosTargetMapJson;
  }
  // const defaultAppId = appIdentifierIos || appIdentifierAndroid || '';
  // if (defaultAppId) {
  //   process.env.APP_IDENTIFIER = defaultAppId;
  // }

  // 6. Tooling Paths
  const paths = resolveToolingPaths(callerWorkspace, fastlaneDir);

  // 7. Assemble final ENV
  const env: ENV = {
    BUILD_ENVIRONMENT: isProduction ? 'production' : 'development',
    SCHEME: resolveEnvWithFallback('SCHEME', buildType),
    BEFORE_ALL: resolveEnvWithFallback('BEFORE_ALL', buildType),
    WORKSPACE_NAME: resolveEnvWithFallback('WORKSPACE_NAME', buildType),
    // APP_IDENTIFIER: defaultAppId,
    APP_IDENTIFIER_IOS: appIdentifierIos || '',
    APP_IDENTIFIER_ANDROID: appIdentifierAndroid || '',
    IOS_TARGET_IDENTIFIER_MAP: iosTargetMapJson || '',
    iosInfo,
    androidInfo,
    FIREBASE_IOS_APP_ID: resolveEnvWithFallback(
      'FIREBASE_IOS_APP_ID',
      buildType,
    ),
    FIREBASE_CREDENTIALS: resolveEnvWithFallback(
      'FIREBASE_CREDENTIALS',
      buildType,
    ),
    FIREBASE_ANDROID_APP_ID: resolveEnvWithFallback(
      'FIREBASE_ANDROID_APP_ID',
      buildType,
    ),
    GITHUB_REF_NAME: process.env.GITHUB_REF_NAME || gitContext.branch,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || gitContext.repository,
    GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE || callerWorkspace,
    WORKSPACE_PATH: paths.workspacePath,
    ANDROID_PROJECT_PATH: paths.androidProjectPath,

    BUNDLE_GEMFILE: paths.bundleGemfile,
    BUNDLE_PATH: paths.bundlePath,
    BUNDLE_FORCE_RUBY_PLATFORM:
      process.env.BUNDLE_FORCE_RUBY_PLATFORM || 'true',
    FASTLANE_FASTFILE: paths.fastlaneFastfile,

    CALLER_WORKSPACE: callerWorkspace,
    FASTLANE_DIR: fastlaneDir,
    FASTLANE_HIDE_PLUGINS_TABLE: true,
    NO_LOGS: process.env.NO_LOGS !== 'false',
    KEEP_OUTPUTS: process.env.KEEP_OUTPUTS === 'true',

    USE_FRAMEWORKS: process.env.USE_FRAMEWORKS || 'static',
  } as ENV;

  const rubyEnv = await ensureRubyEnvironment(process.env);
  if (rubyEnv.PATH) {
    process.env.PATH = rubyEnv.PATH;
  }
  if (rubyEnv.MISE_DISABLE) {
    process.env.MISE_DISABLE = rubyEnv.MISE_DISABLE;
  }

  globalThis._constants.ENV = {
    ...process.env,
    ...rubyEnv,
    ...env,
  };
  return globalThis._constants.ENV;
}

export function withEnv<T extends (...args: any[]) => any>(action: T) {
  return async (...args: Parameters<T>) => {
    loadDeployEnv();
    const envOptions = Array.isArray(args[0])
      ? args[1]
      : typeof args[0] === 'object' && args[0] !== null
        ? args[0]
        : {};
    const envArgs = Array.isArray(args[0]) ? args[0] : [];
    try {
      await getWorkspaceEnv(envArgs, envOptions);
    } catch {
      // Allow command (e.g. troubleshoot) to run even if workspace has not been initialized yet
    }
    return await action(...args);
  };
}

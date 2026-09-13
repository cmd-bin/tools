import type { ResolveIosBundleIdentifiersResult } from '../xcode.js';
import type { ResolveAndroidIdentifiersResult } from '../android.js';

export type BuildType = 'PROD' | 'DEV';

export type ENV = Record<string, any> & {
  BUILD_ENVIRONMENT: string;
  SCHEME: string;
  BEFORE_ALL: string;
  WORKSPACE_NAME: string;
  APP_IDENTIFIER: string;
  APP_IDENTIFIER_IOS: string;
  APP_IDENTIFIER_ANDROID: string;
  IOS_TARGET_IDENTIFIER_MAP?: string;
  iosInfo?: ResolveIosBundleIdentifiersResult | null;
  androidInfo?: ResolveAndroidIdentifiersResult | null;
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

export interface GetWorkspaceEnvOptions {
  production?: boolean;
  [key: string]: string | boolean | number | undefined;
}

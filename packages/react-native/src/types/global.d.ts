import type { ENV } from '../utils/env_resolutions/types.js';

export interface AppConstants {
  GITHUB_REPO_PATTERN: RegExp;
  CALLER_WORKSPACE: string;
  FASTLANE_DIR: string;
  IPC_SERVER_STOP: () => void;
  PACKAGE_NAME: string;
  ENV: ENV | null;
  [key: string]: any;
}

declare global {
  var _constants: AppConstants;

  namespace globalThis {
    var _constants: AppConstants;
  }
}

export {};

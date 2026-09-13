import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { ENV } from './utils/env_resolutions/types.js';

export const GITHUB_REPO_PATTERN =
  /github\.com([\w,-]+)?[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

export const CALLER_WORKSPACE = process.cwd();
export const FASTLANE_DIR = path.resolve(import.meta.dirname, '..', 'fastlane');

export const FASTLANE_ACTIONS = [
  'check_google_play_console',
  'check_app_store_connect',
  'add_device_to_store_connect',
  'check_device_on_store_connect',
  'manage_app_identifier',
  'manage_app_record',
  'sync_app_assets',
] as const;

export type FastlaneAction = (typeof FASTLANE_ACTIONS)[number];

globalThis._constants = {
  GITHUB_REPO_PATTERN,
  CALLER_WORKSPACE,
  FASTLANE_DIR,
  FASTLANE_ACTIONS,
  IPC_SERVER_STOP: () => {},
  PACKAGE_NAME: pkg.name,
  ENV: null,
};

declare global {
  var _constants: {
    GITHUB_REPO_PATTERN: typeof GITHUB_REPO_PATTERN;
    CALLER_WORKSPACE: typeof CALLER_WORKSPACE;
    FASTLANE_DIR: typeof FASTLANE_DIR;
    FASTLANE_ACTIONS: typeof FASTLANE_ACTIONS;
    IPC_SERVER_STOP: () => void;
    PACKAGE_NAME: string;
    ENV: ENV | null;
  };
}

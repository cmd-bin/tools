import path from "node:path";
import pkg from "../package.json" with { type: "json" };

export const GITHUB_REPO_PATTERN =
  /github\.com([\w,-]+)?[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

export const CALLER_WORKSPACE = process.cwd();
export const FASTLANE_DIR = path.resolve(import.meta.dirname, "..", "fastlane");

globalThis._constants = {
  GITHUB_REPO_PATTERN,
  CALLER_WORKSPACE,
  FASTLANE_DIR,
  IPC_SERVER_STOP: () => {},
  PACKAGE_NAME: pkg.name,
};

declare global {
  var _constants: {
    GITHUB_REPO_PATTERN: typeof GITHUB_REPO_PATTERN;
    CALLER_WORKSPACE: typeof CALLER_WORKSPACE;
    FASTLANE_DIR: typeof FASTLANE_DIR;
    IPC_SERVER_STOP: () => void;
    PACKAGE_NAME: string;
  };
}

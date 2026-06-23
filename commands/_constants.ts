import path from "node:path";

export const GITHUB_REPO_PATTERN =
  /github\.com([\w,-]+)?[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

export const CALLER_WORKSPACE = process.cwd();
export const FASTLANE_DIR = path.resolve(import.meta.dirname, "..", "fastlane");

globalThis._constants = {
  GITHUB_REPO_PATTERN,
  CALLER_WORKSPACE,
  FASTLANE_DIR,
};

declare global {
  var _constants: {
    GITHUB_REPO_PATTERN: typeof GITHUB_REPO_PATTERN;
    CALLER_WORKSPACE: typeof CALLER_WORKSPACE;
    FASTLANE_DIR: typeof FASTLANE_DIR;
  };
}

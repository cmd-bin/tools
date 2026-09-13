import path from 'node:path';
import os from 'node:os';

export interface ToolingPaths {
  workspacePath: string;
  androidProjectPath: string;
  bundleGemfile: string;
  bundlePath: string;
  fastlaneFastfile: string;
}

export function resolveToolingPaths(
  callerWorkspace: string,
  fastlaneDir: string,
): ToolingPaths {
  return {
    workspacePath:
      process.env.WORKSPACE_PATH || path.join(callerWorkspace, 'ios'),
    androidProjectPath:
      process.env.ANDROID_PROJECT_PATH || path.join(callerWorkspace, 'android'),
    bundleGemfile:
      process.env.BUNDLE_GEMFILE || path.join(fastlaneDir, 'Gemfile'),
    bundlePath:
      process.env.BUNDLE_PATH ||
      path.join(os.homedir(), '.cmd-bin', 'react-native', 'vendor', 'bundle'),
    fastlaneFastfile: path.join(fastlaneDir, 'Fastfile'),
  };
}

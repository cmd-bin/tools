import { type CAC } from 'cac';
import { log } from '@clack/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import { ensureRubyEnvironment } from '../../utils/ruby.js';
import { resolveGitContext } from '../../utils/env_resolutions/git.js';
import { resolveToolingPaths } from '../../utils/env_resolutions/paths.js';
import { getWorkspaceEnv, withEnv } from '../../utils/env_resolutions/index.js';
import { hasAndroidProject } from '../../utils/android.js';
import { hasIosProject } from '../../utils/xcode.js';
import {
  createLiveSummary,
  type LiveSummaryTaskResult,
} from '../../utils/live_summary.js';

export interface CheckResult extends LiveSummaryTaskResult {
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
  version?: string;
  path?: string;
  repo?: string;
  branch?: string;
  remote?: string;
  lines?: string[];
  rubyEnv?: Record<string, string | undefined>;
  results?: Array<{
    ok: boolean;
    label: string;
    message?: string;
    hint?: string;
    details?: string;
    lines?: string[];
  }>;
}

export interface TroubleshootCheck {
  label: string;
  result: CheckResult;
}

export interface TroubleshootItem {
  label: string;
  state: 'pending' | 'running' | 'ok' | 'fail' | 'skipped';
  runningMessage?: string;
  result?: CheckResult;
}

function runCommand(command: string, args: string[], options: any = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function runCommandAsync(
  command: string,
  args: string[],
  options: any = {},
): Promise<{ stdout: string; stderr: string; error?: Error; status: number | null }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    const finish = (result: any) => {
      if (resolved) return;
      resolved = true;
      resolve({ stdout, stderr, ...result });
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (data) => {
      stdout += data;
    });
    child.stderr?.on('data', (data) => {
      stderr += data;
    });
    child.on('error', (error) => finish({ error, status: null }));
    child.on('close', (status: number | null, signal) => finish({ status, signal }));
  });
}

function buildSuccessExtra(result: CheckResult): string {
  if (result.version) return ` (${result.version})`;
  if (result.path) return ` (${result.path})`;
  if (result.repo && result.branch) return ` (${result.repo} @ ${result.branch})`;
  if (result.repo) return ` (${result.repo})`;
  if (result.branch) return ` (${result.branch})`;
  return '';
}

function checkEnvDeploy(): CheckResult {
  const envDeployPath = path.join(
    globalThis._constants.CALLER_WORKSPACE,
    '.env.deploy',
  );

  if (!fs.existsSync(envDeployPath)) {
    return {
      ok: false,
      code: 'ACTIONS_ENV_DEPLOY_MISSING',
      message: '.env.deploy file not found.',
      hint: 'Run `npx @cmd-bin/react-native init` first to generate .env.deploy.',
      details: envDeployPath,
    };
  }

  return {
    ok: true,
    meta: {
      Path: envDeployPath,
    },
    path: envDeployPath,
  };
}

function checkKnownHosts(): CheckResult {
  const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');

  if (!fs.existsSync(knownHostsPath)) {
    return {
      ok: false,
      code: 'ACTIONS_KNOWN_HOSTS_MISSING',
      message: 'known_hosts file not found.',
      hint: 'Run `ssh-keyscan -H github.com >> ~/.ssh/known_hosts`.',
      details: knownHostsPath,
    };
  }

  const result = runCommand('ssh-keygen', [
    '-F',
    'github.com',
    '-f',
    knownHostsPath,
  ]);

  if (result.error || result.status !== 0 || !String(result.stdout || '').trim()) {
    return {
      ok: false,
      code: 'ACTIONS_KNOWN_HOSTS_GITHUB_MISSING',
      message: 'No github.com entry found in known_hosts.',
      hint: 'Run `ssh-keyscan -H github.com >> ~/.ssh/known_hosts`.',
      details: knownHostsPath,
    };
  }

  return { ok: true };
}

function checkRepositoryAccess(): CheckResult {
  try {
    const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
    const gitContext = resolveGitContext(callerWorkspace);

    if (!gitContext.repository || !gitContext.branch) {
      return {
        ok: false,
        code: 'ACTIONS_REPOSITORY_UNRESOLVED',
        message: 'Could not resolve repository or branch information.',
        hint: 'Verify git remote origin and active branch.',
        details: `repo=${gitContext.repository || 'unknown'}, branch=${gitContext.branch || 'unknown'}`,
      };
    }

    return {
      ok: true,
      extra:
        gitContext.repository && gitContext.branch
          ? `${gitContext.repository} @ ${gitContext.branch}`
          : undefined,
      meta: {
        Remote: `github.com:${gitContext.repository}.git`,
        Repo: gitContext.repository,
        Branch: gitContext.branch,
      },
      repo: gitContext.repository,
      branch: gitContext.branch,
      remote: `github.com:${gitContext.repository}.git`,
    };
  } catch (error: any) {
    return {
      ok: false,
      code: 'ACTIONS_REPOSITORY_CHECK_FAILED',
      message: 'Failed to resolve repository or branch from workspace.',
      hint: 'Ensure you are inside a git repository with a configured remote origin.',
      details: error.message,
    };
  }
}

function checkNode(): CheckResult {
  const nodeVersion = process.versions?.node;

  if (!nodeVersion) {
    return {
      ok: false,
      code: 'ACTIONS_NODE_REQUIRED',
      message: '`node` is not executable.',
      hint: 'Install Node.js and try again.',
    };
  }

  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major < 24) {
    return {
      ok: false,
      code: 'ACTIONS_NODE_VERSION_LOW',
      message: `Node.js >= 24 is required; found: ${nodeVersion}.`,
      hint: 'Update Node.js to version 24 or higher.',
    };
  }

  return { ok: true, extra: `v${nodeVersion.replace(/^v/, '')}`, version: nodeVersion };
}

async function checkRubyEnvironment(): Promise<CheckResult> {
  try {
    const portableRubyDir = path.join(
      os.homedir(),
      '.cmd-bin',
      'lib',
      'ruby',
      'ruby-4.0.6',
      'bin',
    );
    const hasPortable = fs.existsSync(path.join(portableRubyDir, 'ruby'));

    const rubyEnv = await ensureRubyEnvironment(process.env, true);
    const result = runCommand('ruby', ['-v'], {
      env: { ...process.env, ...rubyEnv },
    });

    if (result.error || result.status !== 0) {
      return {
        ok: false,
        code: 'ACTIONS_RUBY_FAILED',
        message: 'Failed to execute Ruby environment.',
        hint: 'Check ensureRubyEnvironment or system Ruby installation.',
        details: result.error?.message || result.stderr || result.stdout,
      };
    }

    const output = (result.stdout || '').trim();
    const versionMatch = output.match(/^ruby (\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : output.split(' ')[1] || output;

    const runtimeType = hasPortable ? 'Portable' : 'System';
    const rubyPath = hasPortable
      ? path.join(portableRubyDir, 'ruby')
      : 'system PATH';


    return {
      ok: true,
      rubyEnv,
      meta: {
        Type: runtimeType,
        Version: version,
        Path: rubyPath
      }
    };
  } catch (error: any) {
    return {
      ok: false,
      code: 'ACTIONS_RUBY_CHECK_FAILED',
      message: 'Unexpected error while verifying Ruby environment.',
      hint: 'Check Ruby installation and permissions.',
      details: error.message,
    };
  }
}

function checkXcbeautify(): CheckResult {
  const result = runCommand('xcbeautify', ['--version']);

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      code: 'ACTIONS_XCBEAUTIFY_MISSING',
      message: '`xcbeautify` not found (recommended for formatted iOS build logs).',
      hint: 'Install via `brew install xcbeautify`.',
      details: result.error?.message,
    };
  }

  const version = (result.stdout || '').trim();
  return { ok: true, extra: version, version };
}

function checkGh(): CheckResult {
  const result = runCommand('gh', ['--version']);

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      code: 'ACTIONS_GH_MISSING',
      message: 'GitHub CLI (`gh`) not found.',
      hint: 'Install via `brew install gh` and authenticate with `gh auth login`.',
      details: result.error?.message,
    };
  }

  const match = (result.stdout || '').match(/gh version (\S+)/);
  const version = match ? match[1] : (result.stdout || '').split('\n')[0];
  return {
    ok: true,
    extra: version,
    version,
  };
}

function checkVendorBundle(rubyEnv: Record<string, string | undefined>): CheckResult {
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;
  const paths = resolveToolingPaths(
    globalThis._constants.CALLER_WORKSPACE,
    fastlaneDir,
  );

  const env = {
    ...process.env,
    ...rubyEnv,
    BUNDLE_GEMFILE: paths.bundleGemfile,
    BUNDLE_PATH: paths.bundlePath,
    BUNDLE_FORCE_RUBY_PLATFORM: 'true',
  };

  const result = runCommand('bundle', ['check'], {
    cwd: fastlaneDir,
    env,
  });

  if (result.status === 0) {
    return {
      ok: true,
      path: paths.bundlePath,
      lines: ["The Gemfile's dependencies are satisfied"],
    };
  }

  return {
    ok: false,
    code: 'ACTIONS_VENDOR_BUNDLE_MISSING',
    message: 'Vendor bundle gem dependencies are missing or incomplete.',
    hint: 'Run `npx @cmd-bin/react-native bundle install` to install dependencies.',
    details: (result.stderr || result.stdout || '').trim() || undefined,
  };
}

function materializeFirebaseCredentials(target: {
  credentials?: string;
  platform: string;
  tier: string;
}): string {
  const rawValue = String(target.credentials || '').trim();

  if (fs.existsSync(rawValue)) {
    return rawValue;
  }

  const fileName = `cmd-bin-firebase-${target.platform}-${target.tier}-${process.pid}.json`;
  const filePath = path.join(os.tmpdir(), fileName);
  try {
    const decoded = Buffer.from(rawValue, 'base64').toString('utf8');
    if (decoded.includes('{')) {
      fs.writeFileSync(filePath, decoded, 'utf8');
      return filePath;
    }
  } catch {
    // Ignore base64 decode failure and write raw value
  }

  fs.writeFileSync(filePath, rawValue, 'utf8');
  return filePath;
}

function cleanupFirebaseCredentialsFile(filePath?: string | null) {
  if (!filePath) return;
  try {
    const tempDir = os.tmpdir();
    if (filePath.startsWith(tempDir) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup error
  }
}

function summarizeFirebaseReleaseOutput(output: string): string[] {
  const text = String(output || '');
  const displayVersion = text.match(
    /displayVersion["']?\s*[:=>]+\s*["']?([^"'\s,}]+)/i,
  )?.[1];
  const buildVersion = text.match(
    /buildVersion["']?\s*[:=>]+\s*["']?([^"'\s,}]+)/i,
  )?.[1];
  const releaseName = text.match(
    /releaseName["']?\s*[:=>]+\s*["']?([^"'\s,}]+)/i,
  )?.[1];
  const releaseId = text.match(
    /releaseId["']?\s*[:=>]+\s*["']?([^"'\s,}]+)/i,
  )?.[1];

  const summaryParts: string[] = [];
  if (displayVersion) summaryParts.push(`version=${displayVersion}`);
  if (buildVersion) summaryParts.push(`build=${buildVersion}`);
  if (releaseName) summaryParts.push(`name=${releaseName}`);
  if (releaseId) summaryParts.push(`id=${releaseId}`);

  if (summaryParts.length === 0) {
    return ['Latest release info retrieved.'];
  }

  return [`Latest release: ${summaryParts.join(', ')}`];
}

async function checkFirebaseServiceAccount(
  rubyEnv: Record<string, string | undefined>,
  onProgress?: (msg: string) => void,
): Promise<CheckResult> {
  const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;

  const targets = [
    {
      label: 'iOS DEV',
      appId: process.env.FIREBASE_IOS_APP_ID_DEV || process.env.FIREBASE_IOS_APP_ID,
      credentials:
        process.env.FIREBASE_CREDENTIALS_DEV || process.env.FIREBASE_CREDENTIALS,
      tier: 'dev',
      platform: 'ios',
    },
    {
      label: 'iOS PROD',
      appId: process.env.FIREBASE_IOS_APP_ID_PROD,
      credentials:
        process.env.FIREBASE_CREDENTIALS_PROD || process.env.FIREBASE_CREDENTIALS,
      tier: 'prod',
      platform: 'ios',
    },
    {
      label: 'Android DEV',
      appId:
        process.env.FIREBASE_ANDROID_APP_ID_DEV ||
        process.env.FIREBASE_ANDROID_APP_ID,
      credentials:
        process.env.FIREBASE_CREDENTIALS_DEV || process.env.FIREBASE_CREDENTIALS,
      tier: 'dev',
      platform: 'android',
    },
    {
      label: 'Android PROD',
      appId: process.env.FIREBASE_ANDROID_APP_ID_PROD,
      credentials:
        process.env.FIREBASE_CREDENTIALS_PROD || process.env.FIREBASE_CREDENTIALS,
      tier: 'prod',
      platform: 'android',
    },
  ].filter(({ appId }) => Boolean(appId && String(appId).trim()));

  if (targets.length === 0) {
    return {
      ok: true,
      lines: ['Firebase app ID is not configured in .env.deploy (skipped).'],
      results: [],
    };
  }

  const results: Array<{
    ok: boolean;
    label: string;
    message?: string;
    hint?: string;
    details?: string;
    lines?: string[];
  }> = [];

  const paths = resolveToolingPaths(callerWorkspace, fastlaneDir);

  for (const target of targets) {
    onProgress?.(`Querying latest Firebase release for ${target.label}`);

    if (!target.credentials || !String(target.credentials).trim()) {
      results.push({
        ok: false,
        label: target.label,
        message: `Firebase credentials not found (${target.label}).`,
        hint: 'Check FIREBASE_CREDENTIALS variable in .env.deploy.',
      });
      continue;
    }

    let credentialsPath: string | null = null;
    try {
      credentialsPath = materializeFirebaseCredentials(target);
      const env = {
        ...process.env,
        ...rubyEnv,
        BUNDLE_GEMFILE: paths.bundleGemfile,
        BUNDLE_PATH: paths.bundlePath,
        BUNDLE_FORCE_RUBY_PLATFORM: 'true',
        FASTLANE_DIR: fastlaneDir,
      };

      const result = await runCommandAsync(
        'bundle',
        [
          'exec',
          'fastlane',
          'run',
          'firebase_app_distribution_get_latest_release',
          `app:${target.appId}`,
          `service_credentials_file:${credentialsPath}`,
        ],
        { cwd: fastlaneDir, env },
      );

      const combinedOutput = [result.stdout, result.stderr]
        .filter((chunk) => chunk && String(chunk).trim())
        .map((chunk) => String(chunk).trim())
        .join('\n');

      if (result.error || result.status !== 0) {
        results.push({
          ok: false,
          label: target.label,
          message: `Firebase latest release query failed (${target.label}).`,
          hint: 'Verify Firebase app ID and credentials format.',
          details: (result.error?.message || combinedOutput).trim(),
        });
      } else {
        results.push({
          ok: true,
          label: target.label,
          lines: summarizeFirebaseReleaseOutput(combinedOutput),
        });
      }
    } catch (error: any) {
      results.push({
        ok: false,
        label: target.label,
        message: `Firebase latest release query failed (${target.label}).`,
        hint: 'Verify Firebase app ID and credentials format.',
        details: error.message,
      });
    } finally {
      if (credentialsPath) cleanupFirebaseCredentialsFile(credentialsPath);
    }
  }

  return {
    ok: results.every((item) => item.ok),
    results,
    subItems: results,
  };
}

function summarizeAppleStoreConnectOutput(output: string): string | null {
  const text = String(output || '');
  const match = text.match(
    /Latest TestFlight build number for\s+([^:]+):\s+([0-9A-Za-z._-]+)_([0-9]+)/i,
  );
  if (match) {
    return `Latest TestFlight build: app=${match[1].trim()}, version=${match[2].trim()}, build=${match[3].trim()}`;
  }

  const fallbackMatch = text.match(
    /build_number["']?\s*[:=>]+\s*["']?(\d+)["']?.*version["']?\s*[:=>]+\s*["']?([^"',}\s]+)/i,
  );
  if (fallbackMatch) {
    return `Latest TestFlight build: version=${fallbackMatch[2]}, build=${fallbackMatch[1]}`;
  }

  return null;
}

async function checkAppleStoreConnect(
  rubyEnv: Record<string, string | undefined>,
  isProduction: boolean,
): Promise<CheckResult> {
  const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;

  const hasIos = hasIosProject(callerWorkspace);
  const appIdentifier =
    process.env.APP_IDENTIFIER_IOS || process.env.APP_IDENTIFIER;

  if (!hasIos && !appIdentifier) {
    return {
      ok: true,
      lines: ['Skipped (no iOS project or APP_IDENTIFIER found).'],
    };
  }

  const hasAppleKey = Boolean(process.env.APPLE_KEY);
  const hasKeyId = Boolean(process.env.APPLE_KEY_ID);
  const hasIssuerId = Boolean(process.env.APPLE_ISSUER_ID);

  if (!hasAppleKey || !hasKeyId || !hasIssuerId) {
    return {
      ok: false,
      code: 'ACTIONS_APPLE_CREDENTIALS_MISSING',
      message: 'Apple Store Connect API credentials missing.',
      hint: 'Add APPLE_KEY, APPLE_KEY_ID, and APPLE_ISSUER_ID to .env.deploy.',
      details: 'Missing APPLE_KEY / APPLE_KEY_ID / APPLE_ISSUER_ID in environment',
    };
  }

  let workspaceEnv: any = {};
  try {
    workspaceEnv = await getWorkspaceEnv(['ios'], { production: isProduction });
  } catch {
    workspaceEnv = {
      ...process.env,
      APP_IDENTIFIER_IOS: appIdentifier || '',
    };
  }

  const paths = resolveToolingPaths(callerWorkspace, fastlaneDir);
  const env = {
    ...process.env,
    ...rubyEnv,
    ...workspaceEnv,
    BUNDLE_GEMFILE: paths.bundleGemfile,
    BUNDLE_PATH: paths.bundlePath,
    BUNDLE_FORCE_RUBY_PLATFORM: 'true',
    FASTLANE_DIR: fastlaneDir,
  };

  try {
    const result = await runCommandAsync(
      'bundle',
      ['exec', 'fastlane', 'run', 'check_app_store_connect'],
      {
        cwd: fastlaneDir,
        env,
      },
    );

    const combinedOutput = [result.stdout, result.stderr]
      .filter((chunk) => chunk && String(chunk).trim())
      .map((chunk) => String(chunk).trim())
      .join('\n');

    if (result.error || result.status !== 0) {
      return {
        ok: false,
        code: 'ACTIONS_APP_STORE_CONNECT_CHECK_FAILED',
        message: 'Apple Store Connect check failed.',
        hint: 'Verify APP_IDENTIFIER and APPLE_KEY / APPLE_KEY_ID / APPLE_ISSUER_ID values.',
        details: (result.error?.message || combinedOutput).trim(),
      };
    }

    const summary = summarizeAppleStoreConnectOutput(combinedOutput);
    return {
      ok: true,
      lines: summary
        ? [summary]
        : ['Latest TestFlight build info retrieved successfully.'],
    };
  } catch (error: any) {
    return {
      ok: false,
      code: 'ACTIONS_APP_STORE_CONNECT_CHECK_FAILED',
      message: 'Apple Store Connect check failed.',
      hint: 'Verify Apple Store Connect connection and credentials.',
      details: error.message,
    };
  }
}

function summarizeGooglePlayConsoleOutput(output: string): string[] {
  const text = String(output || '');
  const match = text.match(
    /Latest Google Play internal version code for\s+([^:]+):\s+([0-9]+)/i,
  );
  if (match) {
    return [
      `Latest Google Play internal track version: package=${match[1].trim()}, versionCode=${match[2].trim()}`,
    ];
  }

  const match2 = text.match(/version_code["']?\s*[:=>]+\s*["']?([0-9]+)/i);
  if (match2) {
    return [
      `Latest Google Play internal track version: versionCode=${match2[1]}`,
    ];
  }

  return ['Google Play internal track version info retrieved.'];
}

async function checkGooglePlayConsole(
  rubyEnv: Record<string, string | undefined>,
  isProduction: boolean,
): Promise<CheckResult> {
  const callerWorkspace = globalThis._constants.CALLER_WORKSPACE;
  const fastlaneDir = globalThis._constants.FASTLANE_DIR;

  const hasAndroid = hasAndroidProject(callerWorkspace);
  const appIdentifier =
    process.env.APP_IDENTIFIER_ANDROID || process.env.APP_IDENTIFIER;

  if (!hasAndroid && !appIdentifier) {
    return {
      ok: true,
      lines: ['Skipped (no Android project or APP_IDENTIFIER found).'],
    };
  }

  const playStoreCredentials = process.env.PLAY_STORE_CREDENTIALS;
  if (!playStoreCredentials || !String(playStoreCredentials).trim()) {
    return {
      ok: false,
      code: 'ACTIONS_PLAY_STORE_CREDENTIALS_MISSING',
      message: 'Google Play credentials not found.',
      hint: 'Add base64 PLAY_STORE_CREDENTIALS to .env.deploy.',
      details: 'No PLAY_STORE_CREDENTIALS found in .env.deploy',
    };
  }

  let workspaceEnv: any = {};
  try {
    workspaceEnv = await getWorkspaceEnv(['android'], {
      production: isProduction,
    });
  } catch {
    workspaceEnv = {
      ...process.env,
      APP_IDENTIFIER_ANDROID: appIdentifier || '',
    };
  }

  const paths = resolveToolingPaths(callerWorkspace, fastlaneDir);
  const env = {
    ...process.env,
    ...rubyEnv,
    ...workspaceEnv,
    BUNDLE_GEMFILE: paths.bundleGemfile,
    BUNDLE_PATH: paths.bundlePath,
    BUNDLE_FORCE_RUBY_PLATFORM: 'true',
    FASTLANE_DIR: fastlaneDir,
  };

  try {
    const result = await runCommandAsync(
      'bundle',
      ['exec', 'fastlane', 'run', 'check_google_play_console'],
      {
        cwd: fastlaneDir,
        env,
      },
    );

    const combinedOutput = [result.stdout, result.stderr]
      .filter((chunk) => chunk && String(chunk).trim())
      .map((chunk) => String(chunk).trim())
      .join('\n');

    if (result.error || result.status !== 0) {
      return {
        ok: false,
        code: 'ACTIONS_GOOGLE_PLAY_CONSOLE_CHECK_FAILED',
        message: 'Google Play Console query failed.',
        hint: 'Verify Android app identifier and base64 PLAY_STORE_CREDENTIALS values.',
        details: (result.error?.message || combinedOutput).trim(),
      };
    }

    const summary = summarizeGooglePlayConsoleOutput(combinedOutput);
    return {
      ok: true,
      lines: summary,
    };
  } catch (error: any) {
    return {
      ok: false,
      code: 'ACTIONS_GOOGLE_PLAY_CONSOLE_CHECK_FAILED',
      message: 'Google Play Console query failed.',
      hint: 'Verify Google Play Console connection and credentials file.',
      details: error.message,
    };
  }
}

function buildServiceSkipReason(
  envDeployResult?: CheckResult,
  vendorBundleResult?: CheckResult,
): string {
  const reasons: string[] = [];

  if (!envDeployResult?.ok) reasons.push('.env.deploy missing or invalid');
  if (!vendorBundleResult?.ok) reasons.push('vendor/bundle missing or incomplete');

  return reasons.length > 0 ? reasons.join(', ') : 'prerequisites not met';
}

export const troubleshoot = (cli: CAC) => {
  cli
    .command(
      'troubleshoot',
      descriptionLog(
        'Check local tools, Ruby runtime, vendor gems, and mobile release service connections',
      ),
    )
    .option(
      '-p, --production',
      descriptionLog('Use production environment variables (_PROD suffix)'),
    )
    .option(
      '--skip-services',
      descriptionLog(
        'Skip Firebase, App Store Connect, and Google Play Console checks',
      ),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} troubleshoot`))
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} troubleshoot --skip-services`,
      ),
    )
    .action(
      withEnv(async (options: Record<string, any> = {}) => {
        const isProduction = Boolean(options.production);
        const skipServices = Boolean(
          options.skipServices || options['skip-services'],
        );

        const tasks = [
          '.env.deploy',
          'known_hosts',
          'Repository',
          'Node.js',
          'Ruby environment',
          'xcbeautify',
          'GitHub CLI',
          'vendor/bundle',
          ...(!skipServices
            ? [
                'Firebase service account',
                'Apple Store Connect',
                'Google Play Console',
              ]
            : []),
        ];

        const summary = createLiveSummary({
          title: 'Troubleshoot Summary',
          tasks,
        });
        summary.start();

        let resolvedRubyEnv: Record<string, string | undefined> = {};

        await summary.run('.env.deploy', () => checkEnvDeploy());
        await summary.run('known_hosts', () => checkKnownHosts());
        await summary.run('Repository', () => checkRepositoryAccess());
        await summary.run('Node.js', () => checkNode());
        await summary.run('Ruby environment', async () => {
          const res = await checkRubyEnvironment();
          if (res.rubyEnv) {
            resolvedRubyEnv = res.rubyEnv;
          }
          return res;
        });
        await summary.run('xcbeautify', () => checkXcbeautify());
        await summary.run('GitHub CLI', () => checkGh());
        await summary.run('vendor/bundle', () =>
          checkVendorBundle(resolvedRubyEnv),
        );

        const envDeployResult = summary.getItem('.env.deploy')?.result;
        const vendorBundleResult = summary.getItem('vendor/bundle')?.result;

        if (!skipServices) {
          if (vendorBundleResult?.ok && envDeployResult?.ok) {
            await summary.run('Firebase service account', ({ onProgress }) =>
              checkFirebaseServiceAccount(resolvedRubyEnv, onProgress),
            );
            await summary.run('Apple Store Connect', () =>
              checkAppleStoreConnect(resolvedRubyEnv, isProduction),
            );
            await summary.run('Google Play Console', () =>
              checkGooglePlayConsole(resolvedRubyEnv, isProduction),
            );
          } else {
            const reason = buildServiceSkipReason(
              envDeployResult,
              vendorBundleResult,
            );
            summary.skip('Firebase service account', reason);
            summary.skip('Apple Store Connect', reason);
            summary.skip('Google Play Console', reason);
          }
        }

        summary.stop();

        if (!summary.isSuccess()) {
          log.error(
            pc.yellow(
              'At least one check failed. Review the hints above and try again.',
            ),
          );
          process.exitCode = 1;
        } else {
          log.success(pc.green('All checks passed successfully.'));
        }
      }),
    );
};

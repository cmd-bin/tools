import path from 'node:path';
import { type CAC } from 'cac';
import { log } from '@clack/prompts';
import pc from 'picocolors';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import {
  getIosIdentifiers,
  hasIosProject,
  type GetIosIdentifiersOptions,
  type ResolveIosBundleIdentifiersResult,
} from '../../utils/xcode.js';
import {
  getAndroidIdentifiers,
  hasAndroidProject,
  type GetAndroidIdentifiersOptions,
  type ResolveAndroidIdentifiersResult,
} from '../../utils/android.js';
import { withEnv } from '../../utils/env_resolutions/index.js';

export {
  getIosIdentifiers,
  hasIosProject,
  getAndroidIdentifiers,
  hasAndroidProject,
  type GetIosIdentifiersOptions,
  type GetAndroidIdentifiersOptions,
  type ResolveIosBundleIdentifiersResult,
  type ResolveAndroidIdentifiersResult,
};

/**
 * Prints iOS identifiers to console
 */
export function printIosIdentifiers(
  iosResult: ResolveIosBundleIdentifiersResult,
  workspaceRoot: string = globalThis._constants.CALLER_WORKSPACE,
): void {
  log.step(pc.bold(pc.blue('iOS')));
  const relRoot = path.relative(workspaceRoot, iosResult.iosRoot) || 'ios';
  log.info(`Path: ${pc.bold(relRoot)}`);
  log.info(
    `Workspace: ${pc.bold(iosResult.workspaceName)} | Scheme: ${pc.bold(iosResult.scheme)} | Configuration: ${pc.bold(iosResult.configuration)}`,
  );

  if (iosResult.mainAppTargetName) {
    log.message(`Main App Target: ${pc.cyan(iosResult.mainAppTargetName)}`, {
      symbol: '🎯',
    });
  }

  for (const target of iosResult.targets) {
    const isMain = target.name === iosResult.mainAppTargetName;
    const targetLabel = isMain
      ? `${pc.bold(pc.green(target.name))} ${pc.dim('(main)')}`
      : pc.bold(target.name);
    const sourceLabel = target.configurationSource
      ? pc.dim(` [${target.configurationSource}]`)
      : '';

    log.message(
      `${targetLabel}\n   ${pc.dim('Bundle ID:')} ${pc.cyan(target.bundle_id)}${sourceLabel}\n   ${pc.dim('Type:')} ${pc.dim(target.productType)}`,
      { symbol: '📦', spacing: 0 },
    );
  }
}

/**
 * Prints Android identifiers to console
 */
export function printAndroidIdentifiers(
  androidResult: ResolveAndroidIdentifiersResult,
  workspaceRoot: string = globalThis._constants.CALLER_WORKSPACE,
): void {
  log.step(pc.bold(pc.blue('Android')));
  const relRoot =
    path.relative(workspaceRoot, androidResult.androidRoot) || 'android';
  log.info(`Path: ${pc.bold(relRoot)}`);

  if (androidResult.applicationId) {
    log.message(
      `Application ID: ${pc.cyan(pc.bold(androidResult.applicationId))}`,
      { symbol: '🤖' },
    );
  }

  if (androidResult.namespace) {
    log.message(`Namespace: ${pc.magenta(androidResult.namespace)}`, {
      symbol: '🏷️ ',
      spacing: 0,
    });
  }

  if (
    androidResult.packageName &&
    androidResult.packageName !== androidResult.namespace
  ) {
    log.message(`Package Name: ${pc.yellow(androidResult.packageName)}`, {
      symbol: '📦',
      spacing: 0,
    });
  }

  if (androidResult.flavors.length > 0) {
    const flavorStrings = androidResult.flavors.map((f) => {
      const parts = [pc.cyan(f.name)];
      if (f.applicationId) parts.push(`appId: ${f.applicationId}`);
      if (f.applicationIdSuffix) {
        parts.push(`suffix: ${f.applicationIdSuffix}`);
      }
      return parts.join(' ');
    });
    log.message(`Flavors: ${flavorStrings.join(' | ')}`, {
      symbol: '🎨',
      spacing: 0,
    });
  }
}

export const listIdentifiers = (cli: CAC) => {
  cli
    .command(
      'list-identifiers',
      descriptionLog(
        'List iOS bundle identifiers and Android applicationId/namespace',
      ),
    )
    .option(
      '--platform <platform>',
      descriptionLog('Specify platform to inspect (ios | android | all)'),
      {
        default: 'all',
      },
    )
    .option(
      '-p, --production',
      descriptionLog('Use production environment variables (_PROD suffix)'),
    )
    .option(
      '-w, --workspace-name <name>',
      descriptionLog('Custom Xcode workspace/project name'),
    )
    .option('-s, --scheme <name>', descriptionLog('Xcode scheme name'))
    .option(
      '-c, --configuration <name>',
      descriptionLog('Xcode configuration name (e.g. Debug, Release)'),
    )
    .option(
      '--workspace-root <path>',
      descriptionLog(
        'Path to project directory (defaults to CALLER_WORKSPACE)',
      ),
      {
        default: globalThis._constants.CALLER_WORKSPACE,
      },
    )
    .option('--json', descriptionLog('Output identifiers as JSON format'))
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} list-identifiers`),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} list-identifiers --platform android`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} list-identifiers --platform ios --production`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} list-identifiers --scheme AppDev`,
      ),
    )
    .action(
      withEnv(async (options: Record<string, unknown>) => {
        try {
          const env = globalThis._constants.ENV;

          const workspaceRoot =
            (options.workspaceRoot as string) ||
            (options['workspace-root'] as string) ||
            env?.CALLER_WORKSPACE ||
            globalThis._constants.CALLER_WORKSPACE;

          const platform = (
            ((options.platform as string) || 'all') as string
          ).toLowerCase();

          const workspaceName =
            (options.workspaceName as string) ||
            (options['workspace-name'] as string) ||
            (options.w as string) ||
            env?.WORKSPACE_NAME;

          const scheme =
            (options.scheme as string) || (options.s as string) || env?.SCHEME;
          const configuration =
            (options.configuration as string) ||
            (options.c as string) ||
            env?.XCODE_CONFIGURATION;
          const production = Boolean(
            options.production ||
            options.p ||
            env?.BUILD_ENVIRONMENT === 'production',
          );

          let iosResult: ResolveIosBundleIdentifiersResult | null = null;
          let androidResult: ResolveAndroidIdentifiersResult | null = null;

          const hasIos = hasIosProject(workspaceRoot);
          const hasAndroid = hasAndroidProject(workspaceRoot);

          // 1. Resolve iOS if requested
          if (platform === 'all' || platform === 'ios') {
            if (platform === 'ios' && !hasIos) {
              throw new Error(
                `iOS project not found (${path.join(workspaceRoot, 'ios')}).`,
              );
            }

            if (hasIos) {
              const canUseEnvIos =
                env?.iosInfo &&
                (!options.scheme || env.iosInfo.scheme === options.scheme) &&
                (!options.workspaceName ||
                  env.iosInfo.workspaceName === options.workspaceName);

              iosResult = canUseEnvIos
                ? env.iosInfo!
                : getIosIdentifiers({
                    workspaceRoot,
                    workspaceName,
                    scheme,
                    configuration,
                    production,
                  });
            }
          }

          // 2. Resolve Android if requested
          if (platform === 'all' || platform === 'android') {
            if (platform === 'android' && !hasAndroid) {
              throw new Error(
                `Android project not found (${path.join(workspaceRoot, 'android')}).`,
              );
            }

            if (hasAndroid) {
              androidResult =
                env?.androidInfo ||
                getAndroidIdentifiers({
                  workspaceRoot,
                  production,
                });
            }
          }

          if (!iosResult && !androidResult) {
            throw new Error(
              `Neither iOS nor Android project found in the specified directory (${workspaceRoot}).`,
            );
          }

          // JSON output
          if (options.json) {
            const output: Record<string, unknown> = {};
            if (env) {
              output.env = {
                appIdentifier: env.APP_IDENTIFIER,
                appIdentifierIos: env.APP_IDENTIFIER_IOS,
                appIdentifierAndroid: env.APP_IDENTIFIER_ANDROID,
                scheme: env.SCHEME,
                workspaceName: env.WORKSPACE_NAME,
                buildEnvironment: env.BUILD_ENVIRONMENT,
              };
            }
            if (iosResult) output.ios = iosResult;
            if (androidResult) output.android = androidResult;
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          // Formatted console output
          if (iosResult) {
            printIosIdentifiers(iosResult, workspaceRoot);
          }

          if (androidResult) {
            printAndroidIdentifiers(androidResult, workspaceRoot);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            log.error(e.message);
          } else {
            log.error(String(e));
          }
          process.exit(1);
        }
      }),
    );
};

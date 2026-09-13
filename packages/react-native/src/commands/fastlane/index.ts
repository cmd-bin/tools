import { clearBuilds } from '../../utils/clear_builds.js';
import { runCommand } from '../../utils/run.js';
import { type CAC } from 'cac';
import { log } from '@clack/prompts';
import pc from 'picocolors';
import { withIpcServer } from '../../utils/ipc_server.js';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import { withEnv } from '../../utils/env_resolutions/index.js';

export const runFastlaneAction = withEnv(
  withIpcServer(
    async (
      actionName: string,
      actionArgs: string[] = [],
      options: Record<string, any> = {},
    ) => {
      try {
        await runCommand(['run', actionName, ...actionArgs], options);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      }
    },
  ),
);

export const fastlane = (cli: CAC) => {
  const commandHandler: (...args: any[]) => void = withEnv(
    withIpcServer(async (args: string[] = [], options = {}) => {
      const platform = args[0];
      const lane = args[1];

      if (platform !== 'ios' && platform !== 'android') {
        log.error(
          platform
            ? `Invalid platform '${platform}'. Fastlane commands must start with 'ios' or 'android'.`
            : `Platform is required. Fastlane commands must start with 'ios' or 'android'.`,
        );
        log.info(pc.bold('Usage:'));
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run <ios|android> <lane> [options]`,
          ),
        );
        log.info(pc.bold('Examples:'));
        log.message(
          exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios internal`),
        );
        log.message(
          exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios adhoc`),
        );
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run android internal`,
          ),
        );
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run android adhoc export_method:apk`,
          ),
        );
        return;
      }

      if (!lane) {
        log.error(`Lane name is required for '${platform}'.`);
        log.info(pc.bold('Usage:'));
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run ${platform} <lane> [options]`,
          ),
        );
        log.info(pc.bold('Examples:'));
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run ${platform} internal`,
          ),
        );
        log.message(
          exampleLog(
            `${globalThis._constants.PACKAGE_NAME} run ${platform} adhoc`,
          ),
        );
        return;
      }

      const isAndroid = platform === 'android';

      try {
        if (options.clean) await clearBuilds(isAndroid ? 'android' : 'ios');
        await runCommand(args, options);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      }
    }),
  );
  cli
    .command(
      'run <...fastlaneArgs>',
      descriptionLog(
        'Execute iOS or Android Fastlane lanes within the configured Ruby environment',
      ),
    )
    .option(
      '-p, --production',
      descriptionLog('Use production environment variables (_PROD suffix)'),
    )
    .option(
      '--clean',
      descriptionLog('Clean build directories (android/ios) before execution'),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios adhoc`))
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios internal`),
    )
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run android adhoc`),
    )
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run android internal`),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run --clean -p ios internal`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run ios pod update:true`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run android adhoc export_method:apk`,
      ),
    )
    .action(commandHandler);
};

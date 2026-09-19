import { type CAC } from 'cac';
import { setTimeout as sleep } from 'node:timers/promises';
import { log, stream } from '@clack/prompts';
import { taskLog } from '@clack/prompts';
import { getRuntime } from '../../utils/runtime.js';
import pkg from '../../../package.json' with { type: 'json' };
import { exampleLog, descriptionLog } from '../../utils/logger.js';

export const status = (cli: CAC) => {
  const commandHandler = async (): Promise<void> => {
    log.success(`${cli.name} is active.`);
    log.info(`Version: ${pkg.version}`, {spacing: 0});
    log.info(`Author: ${pkg.author || 'cmd-bin'}`, {spacing: 0});
    log.info(`Runtime: ${getRuntime()}`, {spacing: 0});
  };

  cli
    .command(
      'status',
      descriptionLog(
        `Display the current status and runtime environment of ${cli.name}`,
      ),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} status`))
    .action(commandHandler);
};

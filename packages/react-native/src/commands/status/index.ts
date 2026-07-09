import { type CAC } from 'cac';
import { log } from '@clack/prompts';
import { getRuntime } from '../../utils/runtime.js';
import pkg from '../../../package.json' with { type: 'json' };
import { exampleLog, descriptionLog } from '../../utils/logger.js';

export const status = (cli: CAC) => {
  const commandHandler = (): void => {
    log.message(`${cli.name} is active.`, { symbol: '✅' });
    log.message(`Version: ${pkg.version}`, { symbol: '🚀', spacing: 0 });
    log.message(`Author: ${pkg.author || 'cmd-bin'}`, {
      symbol: '👤',
      spacing: 0,
    });
    log.message(`Runtime: ${getRuntime()}`, { symbol: '🛠️ ', spacing: 0 });
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

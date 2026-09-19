import { type CAC } from 'cac';
import { log } from '@clack/prompts';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import { createTaskLogger } from '../../utils/taskLogger.js';
import { initCore } from '../../core/init.js';

export const init = (cli: CAC) => {
  const commandHandler = async (): Promise<void> => {
    const onEvent = createTaskLogger();
    const { success } = await initCore(process.cwd(), onEvent);

    if (!success) {
      log.error('Project initialization failed.');
      process.exitCode = 1;
    } else {
      log.success('Project configuration initialized successfully.');
    }
  };

  cli
    .command(
      'init',
      descriptionLog(
        `Initialize necessary files and configurations for the project`,
      ),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} init`))
    .action(commandHandler);
};

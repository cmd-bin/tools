import { type CAC } from 'cac';
import { cleanCore } from '../../core/clean.js';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import { log } from '@clack/prompts';
import { withEnv } from '../../utils/env_resolutions/index.js';
import pc from 'picocolors';

export const clean = (cli: CAC) => {
  cli
    .command(
      'clean',
      descriptionLog('Remove generated build artifacts and clear caches'),
    )
    .option(
      '--platform <type>',
      descriptionLog(
        "Specify which platform's build directories to clean (android | ios | all)",
      ),
      {
        default: 'all',
      },
    )
    .option('--vendor', descriptionLog('Remove vendor bundle directory'))
    .option('--outputs', descriptionLog('Remove lane outputs directory'))
    .option(
      '--derived-data',
      descriptionLog('Remove iOS derived data directory'),
    )
    .option(
      '--dry-run',
      descriptionLog('Simulate clean without deleting any files'),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} clean`))
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} clean --dry-run`),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} clean --platform android`,
      ),
    )
    .action(
      withEnv(async (options) => {
        try {
          await cleanCore(options, (entry) => {
            if (entry.type === 'warning') {
              log.info(pc.yellow(entry.message));
            } else if (entry.type === 'success') {
              log.success(entry.message);
            } else if (entry.type === 'error') {
              log.error(entry.message);
            } else {
              log.info(entry.message);
            }
          });
        } catch (e: unknown) {
          if (e instanceof Error) console.error(e.message);
          else console.error(e);
        }
      }),
    );
};

import { type CAC } from 'cac';
import { clearBuilds } from '../../utils/clear_builds.js';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
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
          const isDryRun = Boolean(options.dryRun || options['dry-run']);
          let didSpecificClean = false;

          if (options.vendor) {
            const env = globalThis._constants.ENV!;
            let vendorPath = env.BUNDLE_PATH;
            if (vendorPath.startsWith('~/') || vendorPath === '~') {
              vendorPath = vendorPath.replace(/^~/, os.homedir());
            }

            const targetPath = path.resolve(vendorPath, '..');
            if (isDryRun) {
              log.info(pc.yellow(`[dry-run] Would delete: ${targetPath}`));
            } else {
              try {
                await fs.rm(targetPath, {
                  recursive: true,
                  force: true,
                });
                log.success(`Vendor bundle cleared: ${vendorPath}`);
              } catch (e: unknown) {
                log.error(`Failed to remove vendor bundle: ${vendorPath}`);
              }
            }
            didSpecificClean = true;
          }

          if (options.outputs) {
            const outputsPath = path.join(
              os.homedir(),
              '.cmd-bin',
              'react-native',
              'lane-outputs',
            );
            if (isDryRun) {
              log.info(pc.yellow(`[dry-run] Would delete: ${outputsPath}`));
            } else {
              try {
                await fs.rm(outputsPath, { recursive: true, force: true });
                log.success(`Lane outputs cleared: ${outputsPath}`);
              } catch (e: unknown) {
                log.error(`Failed to remove lane outputs: ${outputsPath}`);
              }
            }
            didSpecificClean = true;
          }

          if (options.derivedData || options['derived-data']) {
            const derivedDataPath = path.join(
              os.homedir(),
              '.cmd-bin',
              'react-native',
              'ios',
              'derived-data',
            );
            if (isDryRun) {
              log.info(pc.yellow(`[dry-run] Would delete: ${derivedDataPath}`));
            } else {
              try {
                await fs.rm(derivedDataPath, { recursive: true, force: true });
                log.success(`Derived data cleared: ${derivedDataPath}`);
              } catch (e: unknown) {
                log.error(`Failed to remove derived data: ${derivedDataPath}`);
              }
            }
            didSpecificClean = true;
          }

          if (!didSpecificClean) {
            await clearBuilds(options.platform, process.cwd(), isDryRun);
          }
        } catch (e: unknown) {
          if (e instanceof Error) console.error(e.message);
          else console.error(e);
        }
      }),
    );
};

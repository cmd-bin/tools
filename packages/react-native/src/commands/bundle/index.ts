import { type CAC } from 'cac';
import { exec } from '../../utils/executor.js';
import { withIpcServer } from '../../utils/ipc_server.js';
import { exampleLog, descriptionLog } from '../../utils/logger.js';
import { withEnv } from '../../utils/env_resolutions/index.js';

export const bundle = (cli: CAC) => {
  cli
    .command(
      'bundle [...bundleArgs]',
      descriptionLog(
        'Execute Ruby bundler commands directly within the isolated Fastlane environment',
      ),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} bundle install`))
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} bundle update fastlane`,
      ),
    )
    .action(
      withEnv(
        withIpcServer(async (bundleArgs) => {
          try {
            await exec('bundle', bundleArgs);
          } catch (e: unknown) {
            if (e instanceof Error) console.error(e.message);
            else console.error(e);
          }
        }),
      ),
    );
};

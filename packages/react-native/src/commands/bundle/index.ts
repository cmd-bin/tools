import { type CAC } from "cac";
import { runBundle } from "../../utils/run.js";
import { withIpcServer } from "../../utils/ipc_server.js";
import { withEnv } from "../../utils/load_deploy_env.js";
import { exampleLog, descriptionLog } from "../../utils/logger.js";

export const bundle = (cli: CAC) => {
  cli
    .command(
      "bundle [...bundleArgs]",
      descriptionLog(
        "Execute Ruby bundler commands directly within the isolated Fastlane environment",
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
        withIpcServer(async (bundleArgs, options) => {
          try {
            await runBundle(bundleArgs, options);
          } catch (e: unknown) {
            if (e instanceof Error) console.error(e.message);
            else console.error(e);
          }
        }),
      ),
    );
};

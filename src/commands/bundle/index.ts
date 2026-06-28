import { type CAC } from "cac";
import { runBundle } from "../../utils/run.js";
import { withIpcServer } from "../../utils/ipc_server.js";
import { withEnv } from "../../utils/load_deploy_env.js";

export const bundle = (cli: CAC) => {
  cli
    .command(
      "bundle [...bundleArgs]",
      "Run bundler commands directly in the fastlane environment",
    )
    .action(
      withEnv(withIpcServer(async (bundleArgs, options) => {
        try {
          await runBundle(bundleArgs, options);
        } catch (e: unknown) {
          if (e instanceof Error) console.error(e.message);
          else console.error(e);
        }
      })),
    );
};

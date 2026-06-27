import { type CAC } from "cac";
import { runBundle } from "../../utils/run.js";

export const bundle = (cli: CAC) => {
  cli
    .command(
      "bundle [...bundleArgs]",
      "Run bundler commands directly in the fastlane environment",
    )
    .action(async (bundleArgs) => {
      try {
        await runBundle(bundleArgs, cli.options);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      } finally {
        globalThis._constants.IPC_SERVER_STOP?.();
      }
    });
};

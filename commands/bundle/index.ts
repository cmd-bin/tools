import { type CAC } from "cac";
import { loadDeployEnv } from "../build/load_deploy_env.js";
import { runCommand, runBundle } from "../build/run.js";

export const bundle = (cli: CAC) => {
  cli
    .command(
      "bundle [...bundleArgs]",
      "Run bundler commands directly in the fastlane environment",
    )
    .action(async (bundleArgs) => {
      try {
        loadDeployEnv();
        await runBundle(bundleArgs, cli.options);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      }
    });
};

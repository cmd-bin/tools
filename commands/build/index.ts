import { loadDeployEnv } from "./load_deploy_env";
import { clearBuilds } from "./clear_builds";
import { runCommand, runBundle } from "./run";
import { type CAC } from "cac";

export const build = (cli: CAC) => {
  const commandHandler: (...args: any[]) => void = async (args, options) => {
    const isAndroid = args.includes("android");

    try {
      loadDeployEnv();
      if (options.clean) await clearBuilds(isAndroid ? "android" : "ios");
      await runCommand(args, options);
    } catch (e: unknown) {
      if (e instanceof Error) console.error(e.message);
      else console.error(e);
    }
  };
  cli
    .command(
      "build [...fastlaneArgs]",
      "Install Fastlane gems and run bundle exec fastlane",
    )
    .option("-p, --production", "use _PROD env vars")
    .option("--clean", "clean build directories before running fastlane")
    .action(commandHandler);
};

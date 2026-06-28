import { clearBuilds } from "../../utils/clear_builds.js";
import { runCommand } from "../../utils/run.js";
import { type CAC } from "cac";
import { withIpcServer } from "../../utils/ipc_server.js";
import { withEnv } from "../../utils/load_deploy_env.js";

export const fastlane = (cli: CAC) => {
  const commandHandler: (...args: any[]) => void = withEnv(
    withIpcServer(async (args, options) => {
      const isAndroid = args.includes("android");

      try {
        if (options.clean) await clearBuilds(isAndroid ? "android" : "ios");
        await runCommand(args, options);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      }
    }),
  );
  cli
    .command(
      "run [...fastlaneArgs]",
      "Install Fastlane gems and run bundle exec fastlane",
    )
    .option("-p, --production", "use _PROD env vars")
    .option("--clean", "clean build directories before running fastlane")
    .action(commandHandler);
};

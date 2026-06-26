import { clearBuilds } from "./clear_builds.js";
import { runCommand } from "../../utils/run.js";
import { type CAC } from "cac";

export const build = (cli: CAC) => {
  const commandHandler: (...args: any[]) => void = async (args, options) => {
    const isAndroid = args.includes("android");

    try {
      if (options.clean) await clearBuilds(isAndroid ? "android" : "ios");
      await runCommand(args, options);
    } catch (e: unknown) {
      if (e instanceof Error) console.error(e.message);
      else console.error(e);
    }
  };
  cli
    .command(
      "[...fastlaneArgs]",
      "Install Fastlane gems and run bundle exec fastlane",
    )
    .option("-p, --production", "use _PROD env vars")
    .option("--clean", "clean build directories before running fastlane")
    .action(commandHandler);
};

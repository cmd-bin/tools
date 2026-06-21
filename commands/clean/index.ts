import { type CAC } from "cac";
import { clearBuilds } from "../build/clear_builds";

export const clean = (cli: CAC) => {
  cli
    .command("clean", "Clean the build directory")
    .option(
      "--platform <type>",
      "clean build directories for <type>, android/ios/all",
      {
        default: "all",
      },
    )
    .action(async (options) => {
      try {
        await clearBuilds(options.platform);
      } catch (e: unknown) {
        if (e instanceof Error) console.error(e.message);
        else console.error(e);
      }
    });
};

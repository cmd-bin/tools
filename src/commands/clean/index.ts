import { type CAC } from "cac";
import { clearBuilds } from "../../utils/clear_builds.js";
import { exampleLog, descriptionLog } from "../../utils/logger.js";

export const clean = (cli: CAC) => {
  cli
    .command(
      "clean",
      descriptionLog("Remove generated build artifacts and clear caches"),
    )
    .option(
      "--platform <type>",
      descriptionLog(
        "Specify which platform's build directories to clean (android | ios | all)",
      ),
      {
        default: "all",
      },
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} clean`))
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} clean --platform android`,
      ),
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

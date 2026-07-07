import { clearBuilds } from "../../utils/clear_builds.js";
import { runCommand } from "../../utils/run.js";
import { type CAC } from "cac";
import { withIpcServer } from "../../utils/ipc_server.js";
import { withEnv } from "../../utils/load_deploy_env.js";
import { exampleLog, descriptionLog } from "../../utils/logger.js";

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
      "run <...fastlaneArgs>",
      descriptionLog(
        "Execute Fastlane commands within the configured Ruby environment",
      ),
    )
    .option(
      "-p, --production",
      descriptionLog("Use production environment variables (_PROD suffix)"),
    )
    .option(
      "--clean",
      descriptionLog("Clean build directories (android/ios) before execution"),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios adhoc`))
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run ios internal`),
    )
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run android adhoc`),
    )
    .example(
      exampleLog(`${globalThis._constants.PACKAGE_NAME} run android internal`),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run --clean -p ios internal`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run ios pod update:true`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run android adhoc export_method:apk`,
      ),
    )
    .example(
      exampleLog(
        `${globalThis._constants.PACKAGE_NAME} run match_sync type:appstore force:true`,
      ),
    )
    .action(commandHandler);
};

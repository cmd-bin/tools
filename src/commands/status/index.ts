import { type CAC } from "cac";
import { log } from "@clack/prompts";
import { getRuntime } from "../../utils/runtime.js";
import pkg from "../../../package.json" with { type: "json" };

export const status = (cli: CAC) => {
  const commandHandler = (): void => {
    log.message(`${cli.name} is active.`, { symbol: "✅" });
    log.message(`Version: ${pkg.version}`, { symbol: "🚀" });
    log.message(`Runtime: ${getRuntime()}`, { symbol: "🛠️ " });
    globalThis._constants.IPC_SERVER_STOP?.();
  };

  cli
    .command("status", `Display the current status of ${cli.name}`)
    .action(commandHandler);
};

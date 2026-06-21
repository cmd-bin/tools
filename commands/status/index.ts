import { type CAC } from "cac";
import { getRuntime } from "../runtime/index.js";
import pkg from "../../package.json" with { type: "json" };

export const status = (cli: CAC) => {
  const commandHandler = (): void => {
    console.log(`✅ ${cli.name} is active.`);
    console.log(`🚀 Version: ${pkg.version}`);
    console.log(`🛠️ Runtime: ${getRuntime()}`);
  };

  cli
    .command("status", `Display the current status of ${cli.name}`)
    .action(commandHandler);
};

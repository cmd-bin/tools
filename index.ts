/**
 * @module
 * @cmd-kit/react-native - Lean CLI core for React Native development.
 */

import { cac } from "cac";

/**
 * Current version of the toolkit.
 */
export const VERSION: string = "0.0.1";

/**
 * Main CLI instance using CAC.
 */
export const cli = cac("cmd-kit");

// --- Core Commands ---

/**
 * Command: status
 * Simple health check for the toolkit and runtime environment.
 */
cli
  .command("status", "Display the current status of cmd-kit")
  .action((): void => {
    console.log(`✅ @cmd-kit/react-native is active.`);
    console.log(`🚀 Version: ${VERSION}`);
    console.log(`🛠️ Runtime: ${typeof Bun !== "undefined" ? "Bun" : "Node/Deno"}`);
  });

/**
 * Global CLI configuration.
 */
cli.help();
cli.version(VERSION);

/**
 * Main execution function.
 * @param args - Command line arguments (defaults to process.argv)
 */
export function run(args: string[] = process.argv): void {
  try {
    // CAC .parse() metodunu çağırarak komutları işler
    cli.parse(args);
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Entry point for direct execution (e.g., npx/bunx).
 */
if (
  (typeof process !== "undefined" && process.argv[1]?.includes("cmd-kit")) || 
  // @ts-ignore: Bun specific check
  (typeof import.meta.main !== "undefined" && import.meta.main)
) {
  run();
}

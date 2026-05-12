/**
 * @module
 * @cmd-kit/react-native - Lean CLI core for React Native development.
 */

import { cac, type CAC } from "cac";

/**
 * Current version of the toolkit.
 */
export const VERSION: string = "0.0.1";

/**
 * Main CLI instance using CAC.
 */
export const cli: CAC = cac("cmd-kit");

// --- Core Commands ---

cli
  .command("status", "Display the current status of cmd-kit")
  .action((): void => {
    // Bun kontrolünü tip hatası almadan yapmak için globalThis kullanıyoruz
    const isBun = "Bun" in globalThis;
    console.log(`✅ @cmd-kit/react-native is active.`);
    console.log(`🚀 Version: ${VERSION}`);
    console.log(`🛠️ Runtime: ${isBun ? "Bun" : "Node/Deno"}`);
  });

cli.help();
cli.version(VERSION);

/**
 * Main execution function.
 */
export function run(args: string[] = (globalThis as any).process?.argv ?? []): void {
  try {
    cli.parse(args);
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`);
    (globalThis as any).process?.exit(1);
  }
}

/**
 * Entry point guard for direct execution.
 */
if (
  ((globalThis as any).process?.argv[1]?.includes("cmd-kit")) || 
  (import.meta as any).main
) {
  run();
}

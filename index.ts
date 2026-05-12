#!/usr/bin/env node
/**
 * @cmd-bin/react-native - Lean CLI core for React Native development.
 *
 * This module provides the core infrastructure for the Command Kit toolkit.
 * It includes environment detection, status reporting, and a command-line 
 * interface powered by CAC.
 *
 * @example CLI Usage
 * ```bash
 * # Run via npx
 * npx jsr @cmd-bin/react-native status
 *
 * # Run via Bun
 * bunx jsr @cmd-bin/react-native status
 *
 * # Run via Deno
 * deno run -A jsr:@cmd-bin/react-native status
 * ```
 *
 * @example API Usage
 * ```ts
 * import { run } from "@cmd-bin/react-native";
 * 
 * // Execute the CLI with custom arguments
 * run(["node", "bin.js", "status"]);
 * ```
 *
 * @module
 */

import { cac, type CAC } from "cac";

/**
 * The current semantic version of the toolkit.
 */
export const VERSION: string = "0.0.1";

/**
 * The main CAC instance used to define and manage CLI commands.
 */
export const cli: CAC = cac("cmd-bin");

// --- Core Commands ---

cli
  .command("status", "Display the current status of cmd-bin")
  .action((): void => {
    // Determine runtime without type errors
    const isBun = "Bun" in globalThis;
    console.log(`✅ @cmd-bin/react-native is active.`);
    console.log(`🚀 Version: ${VERSION}`);
    console.log(`🛠️ Runtime: ${isBun ? "Bun" : "Node/Deno"}`);
  });

cli.help();
cli.version(VERSION);

/**
 * Main execution function for the CLI.
 * 
 * @param args - Command line arguments to parse. Defaults to `process.argv`.
 * 
 * @example
 * ```ts
 * run(["node", "index.ts", "status"]);
 * ```
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
  ((globalThis as any).process?.argv[1]?.includes("cmd-bin")) ||
  (import.meta as any).main
) {
  run();
}

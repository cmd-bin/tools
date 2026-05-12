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
import pkg from "./package.json" with { type: "json" };

/**
 * The current semantic version of the toolkit.
 */
export const VERSION: string = pkg.version;

/**
 * The main CAC instance used to define and manage CLI commands.
 */
export const cli: CAC = cac(pkg.name);

const global: any = (globalThis as any);
const runtime: string = global["Deno"]?.args ? "Deno" : global["Bun"]?.argv ? "Bun" : "Node";
const runtimeTimeArgs: string[] = (global["Deno"]?.args && [global["Deno"].execPath(), global["Deno"].mainModule, ...global["Deno"]?.args]) ?? global["Bun"]?.argv ?? global["process"]?.argv ?? [];

// --- Core Commands ---

cli
  .command("status", `Display the current status of ${pkg.name}`)
  .action((): void => {
    console.log(`✅ ${pkg.name} is active.`);
    console.log(`🚀 Version: ${VERSION}`);
    console.log(`🛠️ Runtime: ${runtime}`);
  });

cli.help((sections) => {
  sections.push({
    title: "Examples",
    body: `  $ npx ${pkg.name} status
  $ bunx ${pkg.name} status
  $ deno x jsr:${pkg.name} status`,
  });
});

cli.usage("<command> [options]");
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
export function run(args: string[] = runtimeTimeArgs): void {
  try {
    cli.parse(args);
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`);
    process?.exit(1);
  }
}

/**
 * Entry point guard for direct execution.
 */
if (import.meta.main) {
  run();
}

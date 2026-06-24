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
import { intro, outro, log } from "@clack/prompts";
import { cac, type CAC } from "cac";
import "./_constants.js";
import { getRuntimeTimeArgs } from "./runtime/index.js";
import { status } from "./status/index.js";
import { build } from "./build/index.js";
import { bundle } from "./bundle/index.js";
import { clean } from "./clean/index.js";
import pkg from "../package.json" with { type: "json" };

/**
 * The current semantic version of the toolkit.
 */
export const VERSION: string = pkg.version;

intro(`CMD Bin | React Native`);

/**
 * The main CAC instance used to define and manage CLI commands.
 */
const cli: CAC = cac(pkg.name);
cli.version(VERSION);

// --- Core Commands ---
status(cli);
build(cli);
bundle(cli);
clean(cli);

cli.help((sections) => {
  sections.push({
    title: "Examples",
    body: `  $ npx ${pkg.name} status`,
  });
});

cli.usage("<command> [options]");

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
export function run(args: string[]): void {
  try {
    cli.parse(args);
  } catch (error) {
    log.error((error as Error).message);
    process?.exit(1);
  }
}

/**
 * Entry point guard for direct execution.
 */
if (import.meta.main) {
  process.on("exit", (code) => {
    outro("👋  Bye!");
  });
  run(getRuntimeTimeArgs());
}

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
 * ```
 *
 * @module
 */
import { FASTLANE_ACTIONS, type FastlaneAction } from './_constants.js';
import { intro, outro, log } from '@clack/prompts';
import { cac, type CAC } from 'cac';
import { getRuntimeTimeArgs } from './utils/runtime.js';
import { status } from './commands/status/index.js';
import { fastlane, runFastlaneAction } from './commands/fastlane/index.js';
import { bundle } from './commands/bundle/index.js';
import { clean } from './commands/clean/index.js';
import { init } from './commands/init/index.js';
import { listIdentifiers } from './commands/list-identifiers/index.js';
export { FASTLANE_ACTIONS, type FastlaneAction };
export {
  getIosIdentifiers,
  getAndroidIdentifiers,
  printIosIdentifiers,
  printAndroidIdentifiers,
  hasIosProject,
  hasAndroidProject,
  type GetIosIdentifiersOptions,
  type GetAndroidIdentifiersOptions,
} from './commands/list-identifiers/index.js';
import pkg from '../package.json' with { type: 'json' };
import pc from 'picocolors';
import { descriptionLog, exampleLog, titleLog } from './utils/logger.js';

/**
 * The current semantic version of the toolkit.
 */
export const VERSION: string = pkg.version;

/**
 * The main CAC instance used to define and manage CLI commands.
 */
const cli: CAC = cac(pkg.name);
cli.version(VERSION);

// --- Core Commands ---
status(cli);
fastlane(cli);
bundle(cli);
clean(cli);
init(cli);
listIdentifiers(cli);

cli.help((sections) => {
  for (const section of sections) {
    if (section.title) {
      if (
        section.title === 'Usage' ||
        section.title === 'Commands' ||
        section.title === 'Options'
      ) {
        const originalTitle = section.title;
        section.title = titleLog(section.title);

        // Format the descriptions in Commands and Options bodies
        if (originalTitle === 'Commands' || originalTitle === 'Options') {
          section.body = section.body
            .split('\n')
            .map((line) => {
              const match = line.match(/^(\s+.+?)(\s{2,})(.+)$/);
              if (match) {
                const [, name, spacing, description] = match;
                return name + spacing + descriptionLog(description);
              }
              return line;
            })
            .join('\n');
        } else if (originalTitle === 'Usage') {
          section.body = section.body
            .split('\n')
            .map((line) => exampleLog(line))
            .join('\n');
        }
      } else if (section.title.includes('For more info')) {
        section.title = titleLog(
          'For more detailed information, run any command with the `--help` flag',
        );
        section.body = section.body
          .split('\n')
          .map((line) => {
            const cmd = line.trim().replace(/^\$\s*/, '');
            return exampleLog(cmd);
          })
          .join('\n');
      } else {
        section.body = section.body
          .split('\n')
          .map((line) => descriptionLog(line))
          .join('\n');
      }
    } else if (!section.title) {
      section.body = section.body
        .split('\n')
        .map((line) => pc.magenta(line))
        .join('\n');
    }
  }
});
cli.usage('<command> [options]');

cli.example(exampleLog(`${pkg.name} status`));
cli.example(exampleLog(`${pkg.name} run ios internal`));
cli.example(exampleLog(`${pkg.name} run --clean android adhoc`));
cli.example(exampleLog(`${pkg.name} check_google_play_console`));
cli.example(exampleLog(`${pkg.name} check_app_store_connect`));
cli.example(exampleLog(`${pkg.name} clean --platform ios`));
cli.example(exampleLog(`${pkg.name} list-identifiers`));

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
export async function run(args: string[]): Promise<void> {
  let isCommand = false;
  try {
    const parsed = cli.parse(args, { run: false });

    const isHelpOrVersion =
      parsed.options.help ||
      parsed.options.h ||
      parsed.options.version ||
      parsed.options.v ||
      (parsed.args.length === 0 && !cli.matchedCommand);

    if (!isHelpOrVersion) {
      isCommand = true;
      intro(`CMD Bin | React Native`);
    }

    if (!isHelpOrVersion && !cli.matchedCommand) {
      if (parsed.args.length > 0) {
        const unknownCommand = parsed.args[0];
        const actionArgs = parsed.args.slice(1);

        if (FASTLANE_ACTIONS.includes(unknownCommand as any)) {
          await runFastlaneAction(unknownCommand, actionArgs, {
            ...parsed.options,
            production: Boolean(parsed.options.production || parsed.options.p),
          });
          return;
        }

        isCommand = false;
        log.error(`Unknown command '${unknownCommand}'.`);
        log.info(pc.bold('Available commands:'));
        log.message(exampleLog(`${pkg.name} run <ios|android> <lane>`));
        log.message(exampleLog(`${pkg.name} bundle [...args]`));
        log.message(exampleLog(`${pkg.name} clean`));
        log.message(exampleLog(`${pkg.name} init`));
        log.message(exampleLog(`${pkg.name} status`));
        log.message(exampleLog(`${pkg.name} list-identifiers`));
        log.info(pc.bold('Available Fastlane actions:'));
        for (const action of FASTLANE_ACTIONS) {
          log.message(exampleLog(`${pkg.name} ${action}`));
        }
        return;
      }
    }

    const result = cli.runMatchedCommand();

    if (result instanceof Promise) {
      await result;
    }
  } catch (error) {
    log.error((error as Error).message);
    process?.exit(1);
  } finally {
    globalThis._constants.IPC_SERVER_STOP?.();
    if (isCommand) {
      outro('👋  Bye!');
    }
  }
}

/**
 * Entry point guard for direct execution.
 */
if (import.meta.main) {
  process.on('SIGTERM', (code) => {
    globalThis._constants.IPC_SERVER_STOP?.();
  });
  process.on('SIGINT', (code) => {
    globalThis._constants.IPC_SERVER_STOP?.();
  });
  process.on('beforeExit', (code) => {
    globalThis._constants.IPC_SERVER_STOP?.();
  });
  process.on('exit', (code) => {
    globalThis._constants.IPC_SERVER_STOP?.();
  });
  run(getRuntimeTimeArgs());
}

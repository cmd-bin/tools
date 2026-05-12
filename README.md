# @cmd-kit/react-native
Modern, minimalist CLI toolkit for React Native development. Built with CAC for high-performance execution across Bun, Deno, and Node.js.
## Overview
This toolkit provides a set of CLI utilities designed for fast CI/CD workflows and cross-runtime compatibility. It prioritizes speed, type safety, and a minimalist footprint.
## Installation
You can add the package using JSR:
# Using Bun (Recommended)
bunx jsr add @cmd-kit/react-native
# Using NPM
npx jsr add @cmd-kit/react-native
# Using Deno
deno add jsr:@cmd-kit/react-native
## Usage
### CLI Execution
You can run the toolkit directly without installation using npx or bunx:
# Check status and environment
bunx jsr run @cmd-kit/react-native status
## Available Commands
 * status: Displays the current version of the toolkit and identifies the active runtime environment (Bun, Node, or Deno).
 * --help: Displays the help menu with all available commands and options.
 * --version: Shows the current version of the CLI.
## Features
 * Performance First: Minimalist core ensures near-instant startup times.
 * Cross-Runtime: Identical behavior across Bun, Deno, and Node.js.
 * Type Safe: Fully written in TypeScript with explicit type definitions for JSR Fast Check.
## License
Apache-2.0

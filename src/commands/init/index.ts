import { type CAC } from "cac";
import { tasks } from "@clack/prompts";
import fs from "node:fs/promises";
import path from "node:path";
import { exampleLog, descriptionLog } from "../../utils/logger.js";
import { ensureRubyEnvironment } from "../../utils/ruby.js";

export const init = (cli: CAC) => {
  const commandHandler = async (): Promise<void> => {
    const cwd = process.cwd();

    await tasks([
      {
        title: "Checking .env.deploy",
        task: async (message) => {
          const envDeployPath = path.join(cwd, ".env.deploy");
          try {
            await fs.access(envDeployPath);
            return ".env.deploy already exists.";
          } catch {
            await fs.writeFile(envDeployPath, "", "utf-8");
            return "Created .env.deploy";
          }
        },
      },
      {
        title: "Checking .tool-versions",
        task: async (message) => {
          const toolVersionsPath = path.join(cwd, ".tool-versions");
          try {
            await fs.access(toolVersionsPath);
            return ".tool-versions already exists.";
          } catch {
            const currentNodeVersion = process.version.replace(/^v/, "");
            const majorVersion = parseInt(currentNodeVersion.split(".")[0], 10);

            const nodeVersionToUse =
              majorVersion >= 24 ? currentNodeVersion : "26";

            const content = `nodejs ${nodeVersionToUse}\nruby 3.4.8\n`;
            await fs.writeFile(toolVersionsPath, content, "utf-8");
            return `Created .tool-versions (node: ${nodeVersionToUse}, ruby: 3.4.8)`;
          }
        },
      },
      {
        title: "Checking .gitignore",
        task: async (message) => {
          const gitignorePath = path.join(cwd, ".gitignore");
          let content = "";
          try {
            content = await fs.readFile(gitignorePath, "utf-8");
          } catch {
            // .gitignore doesn't exist, will be created
          }

          const lines = content.split("\n");
          let updated = false;

          // Remove trailing empty string if exists due to trailing newline
          if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
          }

          if (!lines.includes(".env.deploy")) {
            lines.push(".env.deploy");
            updated = true;
          }

          if (updated) {
            const newContent = lines.join("\n") + "\n";
            await fs.writeFile(gitignorePath, newContent, "utf-8");
            return "Updated .gitignore";
          }

          return ".gitignore is already up to date.";
        },
      },
      {
        title: "Preparing Ruby Environment",
        task: async (message) => {
          const env = await ensureRubyEnvironment(process.env, true);
          return "Ruby environment is ready.";
        },
      },
    ]);
  };

  cli
    .command(
      "init",
      descriptionLog(
        `Initialize necessary files and configurations for the project`,
      ),
    )
    .example(exampleLog(`${globalThis._constants.PACKAGE_NAME} init`))
    .action(commandHandler);
};

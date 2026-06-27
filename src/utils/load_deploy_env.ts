import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import pc from "picocolors";
import { log } from "@clack/prompts";

let envLoaded = false;

export function loadDeployEnv() {
  if (envLoaded) return;

  const envPath = path.join(
    globalThis._constants.CALLER_WORKSPACE,
    ".env.deploy",
  );
  if (!fs.existsSync(envPath)) return;
  dotenv.config({ path: envPath, override: true, quiet: true });
  const timeString = new Date().toTimeString().split(" ")[0];
  log.success(
    pc.dim(pc.gray(`(${timeString})`)) +
      " ⚙️ " +
      pc.green(
        ` Loaded env from ${pc.bold(path.relative(process.cwd(), envPath))}`,
      ),
  );
  envLoaded = true;
}

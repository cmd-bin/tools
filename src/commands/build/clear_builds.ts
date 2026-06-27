import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { spinner } from "@clack/prompts";
import { formatDuration } from "../../utils/logger.js";

const commonPaths = ["node_modules", "release_notes.md"];

const androidPaths = [
  "/android/.gradle",
  "/android/.idea",
  "/android/.kotlin",
  "/android/build",
  "/android/app/build",
  "/android/app/.cxx",
];

const iosPaths = ["/ios/Pods", "/ios/build", "/derived_data"];
const S = spinner();
export const clearBuilds = async (
  platform = "all",
  rootDir = process.cwd(),
) => {
  const allPaths = [
    ...commonPaths,
    ...(platform === "android" || platform === "all" ? androidPaths : []),
    ...(platform === "ios" || platform === "all" ? iosPaths : []),
  ];
  let timeString = new Date().toTimeString().split(" ")[0];
  let startTimer = performance.now();
  S.start(pc.dim(pc.gray(`(${timeString})`)) + " 🗑️" + " Clearing builds...");
  for (const p of allPaths) {
    const fullPath = path.join(rootDir, p);
    if (fs.existsSync(fullPath)) {
      try {
        await fsp.rm(fullPath, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  }
  timeString = new Date().toTimeString().split(" ")[0];
  S.stop(
    pc.dim(pc.gray(`(${timeString})`)) +
      " " +
      pc.green(
        `✅  All builds cleared. (${pc.bold(formatDuration(performance.now() - startTimer))})`,
      ),
  );
};

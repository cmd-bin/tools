import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";

const commonPaths = [
  "vendor",
  "node_modules",
  "release_notes.md"
]

const androidPaths = [
  "/android/.gradle",
  "/android/.idea",
  "/android/.kotlin",
  "/android/build",
  "/android/app/build",
  "/android/app/.cxx",
]

const iosPaths = [
  "/ios/Pods",
  "/ios/build",
  "/derived_data"
]

export const clearBuilds = async (platform = "all", rootDir = process.cwd()) => {
  const allPaths = [
    ...commonPaths,
    ...(platform === "android" || platform === "all" ? androidPaths : []),
    ...(platform === "ios" || platform === "all" ? iosPaths : [])
  ];

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

  console.log(pc.green("✅   All builds cleared"));
}
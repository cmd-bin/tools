import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "./commands/index.ts",
    platform: "node",
    clean: ["./dist"],
    outDir: "./dist",
    minify: true,
  },
]);

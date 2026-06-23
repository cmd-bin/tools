import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "index.ts",
    platform: "node",
    clean: ["./dist"],
    outDir: "./dist",
  },
]);

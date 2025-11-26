import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  sourcemap: true,
  clean: true,
  dts: false,
  minify: false,
  onSuccess: async () => {
    // Copy system-prompts to dist
    const sourceDir = "src/agents/system-prompts";
    const destDir = "dist/system-prompts";

    mkdirSync(destDir, { recursive: true });
    copyFileSync(join(sourceDir, "po-agent.txt"), join(destDir, "po-agent.txt"));
    copyFileSync(join(sourceDir, "indexer-agent.txt"), join(destDir, "indexer-agent.txt"));
    copyFileSync(join(sourceDir, "analyzer-agent.txt"), join(destDir, "analyzer-agent.txt"));
    console.log("✓ Copied system-prompts to dist/");
  }
});
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
  noExternal: [
    "@contextcode/agents",
    "@contextcode/providers",
    "@contextcode/types",
    "@contextcode/tui"
  ],
  onSuccess: async () => {
    // Copy system-prompts to dist
    const sourceDir = "packages/agents/src/system-prompts";
    const destDir = "dist/system-prompts";

    mkdirSync(destDir, { recursive: true });
    copyFileSync(join(sourceDir, "po-agent.txt"), join(destDir, "po-agent.txt"));
    copyFileSync(join(sourceDir, "indexer-agent.txt"), join(destDir, "indexer-agent.txt"));
    console.log("✓ Copied system-prompts to dist/");
  }
});
import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  sourcemap: true,
  clean: true,
  dts: false,
  minify: false,
  noExternal: [
    "@contextcode/agents",
    "@contextcode/core",
    "@contextcode/providers",
    "@contextcode/types",
    "@contextcode/tui"
  ],
  onSuccess: async () => {
    // Copy system-prompts to dist
    const sourcePrompt = "packages/agents/src/system-prompts/po-agent.txt";
    const destDir = "dist/system-prompts";
    const destFile = join(destDir, "po-agent.txt");
    
    mkdirSync(destDir, { recursive: true });
    copyFileSync(sourcePrompt, destFile);
    console.log("✓ Copied system-prompts to dist/");
  }
});
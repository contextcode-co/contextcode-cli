import { defineConfig } from "tsup";

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
  ]
});
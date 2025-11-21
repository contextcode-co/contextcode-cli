import { runModelSelectUI } from "@contextcode/tui";
import { readUserConfig, updateUserConfig } from "../shared/userConfig.js";

const MODELS = [
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Claude Sonnet 4.5 — Anthropic's flagship reasoning model" }
];

export async function runModelCommand(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Model selection requires an interactive terminal.");
  }

  const current = await readUserConfig();
  const selectedModelId = await runModelSelectUI(current.defaultModel || null, MODELS);
  await updateUserConfig({ defaultModel: selectedModelId });
  const selectedModel = MODELS.find((m) => m.id === selectedModelId);
  console.log(`\nDefault model set to ${selectedModel?.name}.`);
}

function printHelp() {
  console.log(`Usage: contextcode model\n\nSelects the default model used for generation (interactive menu).`);
}

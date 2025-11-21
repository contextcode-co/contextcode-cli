import { selectFromList } from "../utils/select.js";
import { readUserConfig, updateUserConfig } from "../shared/userConfig.js";

const MODELS = [
  { label: "Claude Sonnet 4.5", value: "claude-sonnet-4.5", description: "Anthropic's flagship reasoning model" }
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
  console.log(`Current model: ${current.defaultModel ?? "(not set)"}`);
  const selection = await selectFromList(MODELS, "Select default model:");
  await updateUserConfig({ defaultModel: selection.value });
  console.log(`Default model set to ${selection.label}.`);
}

function printHelp() {
  console.log(`Usage: contextcode model\n\nSelects the default model used for generation (interactive menu).`);
}

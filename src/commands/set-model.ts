import { runModelSelectUI } from "@contextcode/tui";
import { getProviderMetadata, normalizeModelForProvider } from "@contextcode/types";
import { readUserConfig, updateUserConfig } from "../shared/user-config.js";

export async function runModelCommand(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Model selection requires an interactive terminal.");
  }

  const current = await readUserConfig();
  const providerId = current.defaultProvider;
  if (!providerId) {
    throw new Error("No default provider configured. Run `contextcode set provider` first.");
  }

  const metadata = getProviderMetadata(providerId);
  if (!metadata) {
    throw new Error(`Unknown provider "${providerId}". Re-run \`contextcode set provider\`.`);
  }

  const normalized = normalizeModelForProvider(providerId, current.defaultModel);
  const modelOptions = metadata.models.map((model) => ({
    id: model.id,
    name: model.label,
    description: model.description
  }));

  const selectedModelId = await runModelSelectUI(normalized.model ?? null, modelOptions);
  await updateUserConfig({ defaultProvider: providerId, defaultModel: selectedModelId });
  const selectedModel = metadata.models.find((model) => model.id === selectedModelId);
  console.log(`\nDefault model set to ${selectedModel?.label ?? selectedModelId}.`);
}

function printHelp() {
  console.log(`Usage: contextcode model\n\nSelects the default model used for generation (interactive menu).`);
}

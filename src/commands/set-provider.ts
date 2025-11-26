import { readUserConfig, updateUserConfig } from "../shared/user-config.js";
import { isInteractiveSession } from "../utils/prompt.js";
import { loadCredentialProviders, type CredentialProvider } from "../utils/credentials.js";
import { runProviderSelectUI } from "src/tui/index.js";

export type SetProviderPromptOptions = {
  currentProviderId: string | null;
  providers: Array<{ id: string; title: string; description?: string }>;
};

export type SetProviderCommandOptions = {
  interactive?: boolean;
  selectProvider?: (options: SetProviderPromptOptions) => Promise<string>;
  loadProviders?: () => Promise<CredentialProvider[]>;
  persistSelection?: (providerId: CredentialProvider["id"], defaultModel: string) => Promise<void>;
};

export async function runSetProviderCommand(argv: string[], options: SetProviderCommandOptions = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const interactive = options.interactive ?? isInteractiveSession();
  if (!interactive) {
    throw new Error("Provider selection requires an interactive terminal.");
  }

  const providers = await (options.loadProviders ?? loadCredentialProviders)();
  if (!providers.length) {
    throw new Error("No providers found in ~/.contextcode/credentials.json. Run `contextcode auth login` first.");
  }

  const selectProvider = options.selectProvider ?? (async (promptOptions: SetProviderPromptOptions) => {
    return runProviderSelectUI(promptOptions.currentProviderId, promptOptions.providers);
  });

  const userConfig = await readUserConfig();
  const chosenProviderId = await selectProvider({
    currentProviderId: userConfig.defaultProvider ?? null,
    providers: providers.map((provider) => ({
      id: provider.id,
      title: provider.title,
      description: provider.description
    }))
  });

  const selectedProvider = providers.find((provider) => provider.id === chosenProviderId);
  if (!selectedProvider) {
    throw new Error(`Unknown provider selection: ${chosenProviderId}`);
  }

  const persistSelection = options.persistSelection ?? (async (providerId: CredentialProvider["id"], defaultModel: string) => {
    await updateUserConfig({ defaultProvider: providerId, defaultModel });
  });

  await persistSelection(selectedProvider.id, selectedProvider.defaultModel);

  console.log(`\nDefault provider set to ${selectedProvider.title}. Default model: ${selectedProvider.defaultModel}. You can change the model with: contextcode set model`);
}

function printHelp() {
  console.log(`Usage: contextcode set provider\n\nInteractively choose a default provider based on stored credentials.`);
}

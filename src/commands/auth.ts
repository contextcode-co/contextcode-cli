import { ArgError } from "../utils/args.js";

import { updateUserConfig, type UserConfig } from "../shared/user-config.js";
import { listRegisteredProviders } from "src/providers/provider.js";
import { getProviderAuthMethods } from "src/providers/authMethods.js";
import { runAuthLoginUI } from "src/tui/index.js";
import { loadCredential } from "src/providers/credentials.js";

export async function runLoginCommand(_: string[]) {
  const providers = listRegisteredProviders().filter((provider) => provider.login);
  if (!providers.length) {
    throw new Error("No providers available for interactive login.");
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive login requires a TTY session.");
  }

  const providersForUI = providers.map((p) => ({
    id: p.name,
    title: p.title,
    description: p.description || ""
  }));

  const result = await runAuthLoginUI(providersForUI, getProviderAuthMethods);

  const selectedProvider = providers.find((p) => p.name === result.providerId);
  if (selectedProvider?.login) {
    await selectedProvider.login({ interactive: true });
  }

  const configPatch: Partial<UserConfig> = { defaultProvider: result.providerId as "anthropic" | "gemini" };
  if (result.providerId === "gemini") {
    const credential = await loadCredential("gemini");
    if (credential?.key) {
      configPatch.geminiApiKey = credential.key;
    }
  }

  await updateUserConfig(configPatch);
}

function printAuthHelp() {
  console.log(`Usage: contextcode auth <command>\n\nCommands:\n  login    Run interactive OAuth/API setup for a provider`);
}

import { ArgError } from "../utils/args.js";
import { listRegisteredProviders, getProviderAuthMethods, loadCredential } from "@contextcode/providers";
import { runAuthLoginUI } from "@contextcode/tui";
import { updateUserConfig, type UserConfig } from "../shared/userConfig.js";

export async function runAuthCommand(args: string[]) {
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    printAuthHelp();
    return;
  }

  const [subcommand, ...rest] = args;
  if (subcommand === "login") {
    await handleLogin(rest);
    return;
  }

  throw new ArgError(`Unknown auth subcommand: ${subcommand}`);
}

async function handleLogin(_: string[]) {
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

  const configPatch: Partial<UserConfig> = { defaultProvider: result.providerId };
  if (result.providerId === "gemini") {
    const credential = await loadCredential("gemini");
    if (credential?.key) {
      configPatch.geminiApiKey = credential.key;
    }
  }

  await updateUserConfig(configPatch);
  console.log(`\n✅ Authentication successful. Default provider set to ${selectedProvider?.title}.`);
}

function printAuthHelp() {
  console.log(`Usage: contextcode auth <command>\n\nCommands:\n  login    Run interactive OAuth/API setup for a provider`);
}

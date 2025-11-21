import { ArgError } from "../utils/args.js";
import { listRegisteredProviders, runProviderLogin } from "@contextcode/providers";
import { selectFromList } from "../utils/select.js";
import { updateUserConfig } from "../shared/userConfig.js";

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

  console.log("Select a provider to authenticate:");
  const selection = await selectFromList(
    providers.map((provider) => ({
      label: provider.title,
      value: provider.name,
      description: provider.description
    })),
    "Enter provider number:"
  );

  await runProviderLogin(selection.value, { interactive: true });
  await updateUserConfig({ defaultProvider: selection.value });
  console.log(`Authentication successful. Default provider set to ${selection.label}.`);
}

function printAuthHelp() {
  console.log(`Usage: contextcode auth <command>\n\nCommands:\n  login    Run interactive OAuth/API setup for a provider`);
}

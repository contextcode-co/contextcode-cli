import process from "node:process";
import { createRequire } from "node:module";
import { runInitCommand } from "./commands/init.js";
import { runLoginCommand } from "./commands/auth.js";
import { runModelCommand } from "./commands/set-model.js";
import { runGenerateContextCommand } from "./commands/generate-task.js";
import { ArgError } from "./utils/args.js";
import { runSetProviderCommand } from "./commands/set-provider.js";
import { runTaskCommand } from "./commands/task.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version?: string };

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") {
    argv.shift();
  }

  // If no arguments and in interactive terminal, start interactive mode
  if (argv.length === 0) {
    printRootHelp();
    return;
  }

  if (argv.includes("--version") || argv.includes("-V")) {
    console.log(pkg.version ?? "0.0.0");
    return;
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    printRootHelp();
    return;
  }

  const [command, ...rest] = argv;
  switch (command) {
    case "init":
      await runInitCommand(rest);
      return;
    case "tasks":
      await runTaskCommand(rest);
      return;
    case "task":
      await runGenerateContextCommand(rest);
      return;
    case "login":
      await runLoginCommand(rest);
      return;
    case "set":
      await handleSet(rest);
      return;
    default:
      throw new ArgError(`Unknown command: ${command}`);
  }
}

async function handleSet(args: string[]) {
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    printSetHelp();
    return;
  }

  const [subcommand, ...rest] = args;
  if (subcommand === "provider") {
    await runSetProviderCommand(rest);
    return;
  }

  if (subcommand === "model") {
    await runModelCommand(rest);
    return;
  }

  throw new ArgError(`Unknown set subcommand: ${subcommand}`);
}

function printRootHelp() {
  console.log(`contextcode ${pkg.version ?? ""}\n\nUsage:\n  ctx init [path] [options]\n  ctx task [options]\n  ctx login\n  ctx set model\n  ctx set provider\n\nGlobal flags:\n  --version, -V  Show version\n  --help, -h     Show this help text`);
}

function printSetHelp() {
  console.log("Usage:\n  ctx set provider\n\nRun an interactive TUI to pick which credentialed provider should be used by default.");
}

main().catch((err) => {
  if (err instanceof ArgError) {
    console.error(err.message);
  } else {
    console.error(err?.message || err);
  }
  process.exitCode = 1;
});

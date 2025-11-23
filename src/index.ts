import process from "node:process";
import { createRequire } from "node:module";
import { runInitCommand } from "./commands/init.js";
import { runAuthCommand } from "./commands/auth.js";
import { runModelCommand } from "./commands/model.js";
import { runGenerateTaskCommand } from "./commands/generate-task.js";
import { ArgError } from "./utils/args.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version?: string };

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") {
    argv.shift();
  }

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
      await handleTasks(rest);
      return;
    case "generate":
      await handleGenerate(rest);
      return;
    case "auth":
      await runAuthCommand(rest);
      return;
    case "model":
      await runModelCommand(rest);
      return;
    default:
      throw new ArgError(`Unknown command: ${command}`);
  }
}

async function handleTasks(args: string[]) {
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    printTasksHelp();
    return;
  }

  const [subcommand, ...rest] = args;
  if (subcommand === "generate" && rest[0] === "task") {
    await runGenerateTaskCommand(rest.slice(1));
    return;
  }

  printTasksHelp();
  throw new ArgError(`Unknown tasks subcommand: ${subcommand}`);
}

async function handleGenerate(args: string[]) {
  if (args.length === 0) {
    printGenerateHelp();
    return;
  }
  const [subcommand, ...rest] = args;
  if (subcommand === "--help" || subcommand === "-h") {
    printGenerateHelp();
    return;
  }
  if (subcommand === "task") {
    await runGenerateTaskCommand(rest);
    return;
  }
  throw new ArgError(`Unknown generate subcommand: ${subcommand}`);
}

function printRootHelp() {
  console.log(`contextcode ${pkg.version ?? ""}\n\nUsage:\n  contextcode init [path] [options]\n  contextcode generate task [options]\n  contextcode auth login\n  contextcode model\n\nGlobal flags:\n  --version, -V  Show version\n  --help, -h     Show this help text`);
}

function printTasksHelp() {
  console.log("'contextcode tasks' is deprecated. Use `contextcode generate task` instead.");
}

function printGenerateHelp() {
  console.log("Usage:\n  contextcode generate task [options]\n\nUse --help within the command for detailed flags.");
}

main().catch((err) => {
  if (err instanceof ArgError) {
    console.error(err.message);
  } else {
    console.error(err?.message || err);
  }
  process.exitCode = 1;
});

import process from "node:process";
import { createRequire } from "node:module";
import { runInitCommand } from "./commands/init.js";
import { runTasksGenerateCommand } from "./commands/tasksGenerate.js";
import { runAuthCommand } from "./commands/auth.js";
import { runModelCommand } from "./commands/model.js";
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
  if (args.length === 0) {
    printTasksHelp();
    return;
  }
  const [subcommand, ...rest] = args;
  if (subcommand === "generate") {
    await runTasksGenerateCommand(rest);
    return;
  }
  if (subcommand === "--help" || subcommand === "-h") {
    printTasksHelp();
    return;
  }
  throw new ArgError(`Unknown tasks subcommand: ${subcommand}`);
}

function printRootHelp() {
  console.log(`contextcode ${pkg.version ?? ""}\n\nUsage:\n  contextcode init [path] [options]\n  contextcode tasks generate --from-prd <file> [options]\n  contextcode auth login\n  contextcode model\n\nGlobal flags:\n  --version, -V  Show version\n  --help, -h     Show this help text`);
}

function printTasksHelp() {
  runTasksGenerateCommand(["--help"]).catch(() => {
    /* ignore */
  });
}

main().catch((err) => {
  if (err instanceof ArgError) {
    console.error(err.message);
  } else {
    console.error(err?.message || err);
  }
  process.exitCode = 1;
});

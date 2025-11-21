import fs from "fs/promises";
import path from "node:path";
import { parseArgs, ArgError } from "../utils/args.js";
import { promptYesNo, isInteractiveSession } from "../utils/prompt.js";
import { buildIndexAndPersist, ensureDirectoryExists, readExistingIndex, resolveWorkingDirectory } from "../shared/indexing.js";
import { writeAgentLog } from "../shared/logs.js";
import { createContextScaffold, writeJsonFileAtomic } from "@contextcode/core";
import { loadProvider } from "@contextcode/providers";
import { parsePrdIntoTasks } from "@contextcode/agents";
import { readUserConfig } from "../shared/userConfig.js";
import type { Task, TaskList } from "@contextcode/types";

const flagDefinitions = [
  { name: "from-prd", type: "string" as const },
  { name: "cwd", alias: "C", type: "string" as const },
  { name: "out", type: "string" as const },
  { name: "dry-run", type: "boolean" as const },
  { name: "yes", alias: "y", type: "boolean" as const },
  { name: "json", type: "boolean" as const }
];

export async function runTasksGenerateCommand(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const { flags } = parseArgs(argv, flagDefinitions);
  const allowPrompt = canPrompt(flags);
  const prdSource = flags.fromPrd as string | undefined;
  if (!prdSource) {
    throw new ArgError("--from-prd <file> is required");
  }

  const cwdInput = flags.cwd as string | undefined;
  const targetDir = resolveWorkingDirectory(process.cwd(), cwdInput);
  await ensureDirectoryExists(targetDir);

  const interactiveIndexPrompt = allowPrompt;
  const indexRecord = await readExistingIndex(targetDir);
  let indexJson = indexRecord?.index;

  if (!indexJson) {
    if (!interactiveIndexPrompt) {
      throw new Error("[ERR_NO_INDEX] index not found. Run `contextcode init` first or run interactively to create index.");
    }
    const shouldScan = await promptYesNo("No index found. Run scan now?", true);
    if (!shouldScan) {
      throw new Error("[ERR_NO_INDEX] index not found. Run `contextcode init` first.");
    }
    console.log("Index not found. Running repository scan...");
    const scanResult = await buildIndexAndPersist(targetDir);
    indexJson = scanResult.index;
  }

  const prdText = await readPrd(prdSource, targetDir);
  if (!prdText.trim()) {
    throw new Error("Provided PRD is empty.");
  }

  const userConfig = await readUserConfig();
  const providerName = (process.env.CONTEXTCODE_PROVIDER ?? userConfig.defaultProvider ?? "").trim();
  if (!providerName) {
    throw new Error("Provider not configured. Run `contextcode auth login` or set CONTEXTCODE_PROVIDER.");
  }
  const modelName = (process.env.CONTEXTCODE_MODEL ?? userConfig.defaultModel ?? "claude-sonnet-4.5").trim();
  const provider = await loadProvider(providerName, { cwd: targetDir, interactive: allowPrompt });

  const taskList = await parsePrdIntoTasks({
    provider,
    model: modelName,
    indexJson,
    prdText
  });

  const jsonMode = Boolean(flags.json);
  const writer = jsonMode ? process.stderr : process.stdout;
  renderPreview(taskList, writer);

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(taskList, null, 2)}\n`);
  }

  if (flags.dryRun) {
    return;
  }

  const { agentLogDir, contextDocsDir } = await createContextScaffold(targetDir);
  const outputPath = resolveOutputPath(targetDir, contextDocsDir, flags.out as string | undefined);

  let shouldWrite = Boolean(flags.yes);
  if (!shouldWrite && allowPrompt) {
    shouldWrite = await promptYesNo(`Write tasks to ${formatDisplayPath(targetDir, outputPath)}?`, true);
  }

  if (!shouldWrite) {
    console.log("Preview only. Pass --yes to accept and write tasks.");
    return;
  }

  await writeJsonFileAtomic(outputPath, taskList);
  await writeAgentLog(agentLogDir, "tasks-generate", {
    command: "tasks generate",
    provider: providerName,
    model: modelName,
    prdSource,
    outputPath
  });

  console.log(`Tasks saved to ${formatDisplayPath(targetDir, outputPath)}`);
}

function printHelp() {
  console.log(`Usage: contextcode tasks generate --from-prd <file> [options]\n\nOptions:\n  --from-prd <file>   Source PRD file or - for stdin\n  -C, --cwd <path>    Target working directory\n  --out <file>        Output path for tasks.json (default: context-docs/tasks.json)\n  --dry-run           Preview without writing\n  --yes               Accept preview and write without prompting\n  --json              Print resulting JSON to stdout (combine with --yes to write)\n  -h, --help          Show this help text\n\nConfigure provider/model via:\n  contextcode auth login\n  contextcode model`);
}

function canPrompt(flags: Record<string, unknown>) {
  return !flags.yes && !flags.json && isInteractiveSession();
}

async function readPrd(source: string, cwd: string) {
  if (source === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  const filePath = path.isAbsolute(source) ? source : path.join(cwd, source);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`PRD file not found: ${filePath}`);
    }
    throw err;
  }
}

function renderPreview(taskList: TaskList, stream: NodeJS.WritableStream) {
  const write = (line = "") => stream.write(`${line}\n`);
  write(`Summary: ${taskList.summary}`);
  write("Tasks:");
  const table = buildTaskTable(taskList.tasks);
  for (const row of table) {
    write(row);
  }
}

function buildTaskTable(tasks: Task[]) {
  const headers = ["#", "Task", "Objective"];
  const rows = tasks.map((task, index) => [String(index + 1), truncate(task.title, 40), truncate(task.objective, 60)]);
  const widths = headers.map((header, idx) => Math.max(header.length, ...rows.map((row) => row[idx].length)));
  const formatRow = (cols: string[]) => cols.map((col, idx) => col.padEnd(widths[idx])).join("  ");
  return [formatRow(headers), formatRow(widths.map((w) => "-".repeat(w))), ...rows.map((row) => formatRow(row))];
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function resolveOutputPath(cwd: string, contextDocsDir: string, outFlag?: string) {
  if (outFlag) {
    return path.isAbsolute(outFlag) ? outFlag : path.join(cwd, outFlag);
  }
  return path.join(contextDocsDir, "tasks.json");
}

function formatDisplayPath(baseDir: string, targetPath: string) {
  const relative = path.relative(baseDir, targetPath);
  return relative.startsWith("..") ? targetPath : relative || ".";
}

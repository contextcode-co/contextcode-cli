import fs from "fs/promises";
import fsExtra from "fs-extra";
import path from "node:path";
import { parseArgs, ArgError } from "../utils/args.js";
import { ensureDirectoryExists, resolveWorkingDirectory, readExistingIndex, buildIndexAndPersist } from "../shared/indexing.js";
import { promptText, promptYesNo, isInteractiveSession } from "../utils/prompt.js";
import { readUserConfig } from "../shared/userConfig.js";
import { createContextScaffold, writeJsonFileAtomic } from "@contextcode/core";
import { loadProvider } from "@contextcode/providers";
import { type Task } from "@contextcode/types";
import { generateTaskPlanByAgent } from "@contextcode/agents";
import { writeAgentLog } from "../shared/logs.js";

const flagDefinitions = [
  { name: "cwd", alias: "C", type: "string" as const },
  { name: "prompt", alias: "p", type: "string" as const },
  { name: "name", type: "string" as const },
  { name: "provider", type: "string" as const },
  { name: "model", type: "string" as const },
  { name: "yes", alias: "y", type: "boolean" as const }
];

export async function runGenerateTaskCommand(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const { flags } = parseArgs(argv, flagDefinitions);
  const cwdInput = flags.cwd as string | undefined;
  const targetDir = resolveWorkingDirectory(process.cwd(), cwdInput);
  await ensureDirectoryExists(targetDir);

  const promptOverride = normalize(flags.prompt as string | undefined);
  const humanNameOverride = normalize(flags.name as string | undefined);

  let taskPrompt = promptOverride;
  if (!taskPrompt) {
    taskPrompt = await promptText("Describe what you want to implement:");
  }
  if (!taskPrompt) {
    throw new ArgError("A task description is required.");
  }

  let indexRecord = await readExistingIndex(targetDir);
  if (!indexRecord) {
    if (!isInteractiveSession()) {
      throw new Error("Repository index not found. Run `contextcode init` first.");
    }
    const shouldScan = await promptYesNo("No index found. Run `contextcode init` now?", true);
    if (!shouldScan) {
      throw new Error("Index is required to generate tasks. Run `contextcode init` first.");
    }
    const scanResult = await buildIndexAndPersist(targetDir);
    indexRecord = { index: scanResult.index, path: scanResult.outputs?.[0] ?? "" };
  }

  const repoIndex = indexRecord.index;
  const contextDocs = await readContextDocs(targetDir);

  const userConfig = await readUserConfig();
  const providerName = normalize((flags.provider as string | undefined) ?? process.env.CONTEXTCODE_PROVIDER ?? userConfig.defaultProvider);
  if (!providerName) {
    throw new Error("Provider not configured. Run `contextcode auth login` first.");
  }
  const modelName = normalize((flags.model as string | undefined) ?? process.env.CONTEXTCODE_MODEL ?? userConfig.defaultModel) ?? "claude-sonnet-4.5";

  const provider = await loadProvider(providerName, {
    cwd: targetDir,
    interactive: isInteractiveSession(),
    config: userConfig
  });

  const parsed = await generateTaskPlanByAgent(provider, modelName, {
    userPrompt: taskPrompt,
    indexJson: repoIndex,
    docs: contextDocs
  });

  const humanName = humanNameOverride ?? deriveTaskName(taskPrompt);
  const slug = slugify(humanName);

  const { agentLogDir, contextDocsDir } = await createContextScaffold(targetDir);
  const tasksRoot = path.join(contextDocsDir, "tasks");
  await fsExtra.mkdirp(tasksRoot);
  const taskDir = await resolveUniqueDir(tasksRoot, slug);
  await fsExtra.mkdirp(taskDir);

  const overviewPath = path.join(taskDir, "overview.md");
  await fs.writeFile(overviewPath, renderOverviewMarkdown(humanName, taskPrompt, parsed.summary), "utf8");

  const writtenFiles: string[] = [overviewPath];
  for (let i = 0; i < parsed.tasks.length; i++) {
    const task = parsed.tasks[i];
    const stepPath = path.join(taskDir, formatStepFilename(i, task.title));
    await fs.writeFile(stepPath, renderTaskMarkdown(i, task), "utf8");
    writtenFiles.push(stepPath);
  }

  const tasksJsonPath = path.join(taskDir, "tasks.json");
  await writeJsonFileAtomic(tasksJsonPath, parsed);
  writtenFiles.push(tasksJsonPath);

  await writeAgentLog(agentLogDir, "generate-task", {
    command: "generate task",
    provider: providerName,
    model: modelName,
    prompt: taskPrompt,
    outputDir: path.relative(targetDir, taskDir)
  });

  console.log(`Task folder created at ${path.relative(targetDir, taskDir)}`);
  console.log("Generated files:");
  writtenFiles.forEach((file) => {
    console.log(`  - ${path.relative(targetDir, file)}`);
  });
}

function printHelp() {
  console.log(`Usage: contextcode generate task [options]\n\nOptions:\n  -p, --prompt <text>   Task description (interactive prompt if omitted)\n  -C, --cwd <path>      Target directory (default: current)\n      --name <slug>      Friendly task name\n      --provider <id>    Force a specific provider\n      --model <name>     Force a specific model\n  -y, --yes             Auto-accept prompts when possible\n  -h, --help            Show this help text`);
}

function normalize(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function readContextDocs(baseDir: string) {
  const docNames = ["context.md", "features.md", "architecture.md", "implementation-guide.md"] as const;
  const docsDir = path.join(baseDir, "contextcode");
  const payload: Record<string, string> = {};
  await Promise.all(
    docNames.map(async (name) => {
      const full = path.join(docsDir, name);
      try {
        const raw = await fs.readFile(full, "utf8");
        payload[name] = raw;
      } catch {
        // ignore missing docs
      }
    })
  );
  return payload;
}

function deriveTaskName(prompt: string) {
  const words = prompt.split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ") : "New Task";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "task";
}

async function resolveUniqueDir(base: string, slug: string) {
  let candidate = path.join(base, slug);
  let suffix = 1;
  while (await exists(candidate)) {
    candidate = path.join(base, `${slug}-${suffix++}`);
  }
  return candidate;
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function renderOverviewMarkdown(name: string, prompt: string, summary: string) {
  return `# ${name}\n\n**Original request**\n\n${prompt}\n\n## Plan summary\n\n${summary}`;
}

function renderTaskMarkdown(index: number, task: Task) {
  const stepNumber = index + 1;
  const lines: string[] = [];
  lines.push(`# Step ${stepNumber}: ${task.title}`);
  lines.push("", `**Objective:** ${task.objective}`);
  lines.push("", "## Steps");
  lines.push(...task.steps.map((step, idx) => `${idx + 1}. ${step}`));
  lines.push("", "## Suggested files");
  lines.push(...(task.files_hint?.length ? task.files_hint : ["(specify during implementation)"]).map((file) => `- ${file}`));
  lines.push("", "## Acceptance criteria");
  lines.push(...(task.acceptance_criteria?.length ? task.acceptance_criteria : ["(define with the team)"]).map((rule) => `- ${rule}`));
  return lines.join("\n");
}

function formatStepFilename(index: number, title: string) {
  const slug = slugify(title) || `step-${index + 1}`;
  const prefix = String(index + 1).padStart(2, "0");
  return `${prefix}-${slug}.md`;
}
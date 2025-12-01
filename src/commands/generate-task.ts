import fs from "fs/promises";
import fsExtra from "fs-extra";
import path from "node:path";
import React from "react";
import { render } from "ink";
import { parseArgs, ArgError } from "../utils/args.js";
import { promptYesNo, isInteractiveSession } from "../utils/prompt.js";
import { readUserConfig } from "../shared/user-config.js";
import { createContextScaffold, resolveWorkingDirectory, ensureDirectoryExists } from "../utils/json.js";
import { writeAgentLog } from "../shared/logs.js";
import { CONTEXT_DIR } from "../shared/constants.js";
import { normalizeModelForProvider } from "src/types/providers.js";
import { buildRepositoryIndex } from "src/agents/tools/indexer.js";
import { loadProvider } from "src/providers/provider.js";
import { generateTaskPlanByAgent } from "src/agents/task-generator.js";
import { DescriptionPrompt } from "src/tui/components/DescriptionPrompt.js";

const flagDefinitions = [
  { name: "cwd", alias: "C", type: "string" as const },
  { name: "prompt", alias: "p", type: "string" as const },
  { name: "name", type: "string" as const },
  { name: "provider", type: "string" as const },
  { name: "model", type: "string" as const },
  { name: "yes", alias: "y", type: "boolean" as const }
];

export async function runGenerateContextCommand(argv: string[]) {
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

  const userConfig = await readUserConfig();
  const providerName = normalize((flags.provider as string | undefined) ?? process.env.CONTEXTCODE_PROVIDER ?? userConfig.defaultProvider);
  if (!providerName) {
    throw new Error("Provider not configured. Run `contextcode auth login` first.");
  }
  const requestedModel = normalize((flags.model as string | undefined) ?? process.env.CONTEXTCODE_MODEL ?? userConfig.defaultModel);
  const normalizedModel = normalizeModelForProvider(providerName, requestedModel);
  if (normalizedModel.reason === "unknown-provider") {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  if (!normalizedModel.model) {
    throw new Error(`Model missing for provider: ${providerName}`);
  }
  if (normalizedModel.reason === "fallback" && requestedModel) {
    console.warn(
      `Model "${requestedModel}" is not valid for provider "${providerName}". Falling back to "${normalizedModel.model}".`
    );
  }
  const modelName = normalizedModel.model;

  let taskPrompt = promptOverride;
  if (!taskPrompt) {
    taskPrompt = await promptForTaskDescription(providerName, modelName);
  }
  if (!taskPrompt) {
    throw new ArgError("A task description is required.");
  }

  console.log("Analyzing repository...");
  const repoIndex = await buildRepositoryIndex({
    targetDir,
    ignorePatterns: [],
    maxFiles: 10000,
    includeTests: false
  });

  const contextDocs = await readContextDocs(targetDir);

  const provider = await loadProvider(providerName, {
    cwd: targetDir,
    interactive: isInteractiveSession(),
    config: userConfig
  });

  const { raw: taskPlanMarkdown } = await generateTaskPlanByAgent(provider, modelName, {
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

  const planMarkdownFilename = `${slug}-plan.md`;
  const planMarkdownPath = path.join(taskDir, planMarkdownFilename);
  await fs.writeFile(planMarkdownPath, ensureTrailingNewline(taskPlanMarkdown), "utf8");

  const overviewPath = path.join(taskDir, "overview.md");

  const writtenFiles: string[] = [planMarkdownPath, overviewPath];

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

async function promptForTaskDescription(providerName: string, modelName: string) {
  if (!isInteractiveSession()) {
    throw new Error("Interactive prompt not available. Pass --prompt to provide the task description.");
  }

  let submittedValue = "";
  const { unmount, waitUntilExit } = render(
    React.createElement(DescriptionPrompt, {
      provider: providerName,
      model: modelName,
      onSubmit: (value: string) => {
        submittedValue = value.trim();
        unmount();
      }
    })
  );

  await waitUntilExit();
  return submittedValue;
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
  const docsDir = path.join(baseDir, CONTEXT_DIR);
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

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
import path from "node:path";
import { parseArgs, ArgError } from "../utils/args.js";
import { isGitRepository } from "../utils/git.js";
import { buildIndexAndPersist, ensureDirectoryExists, resolveWorkingDirectory } from "../shared/indexing.js";
import { writeAgentLog } from "../shared/logs.js";
import { readUserConfig } from "../shared/userConfig.js";
import type { TokenUsage } from "@contextcode/providers";
import { normalizeModelForProvider } from "@contextcode/types";

const flagDefinitions = [
  { name: "cwd", alias: "C", type: "string" as const },
  { name: "out", type: "string" as const, multiple: true },
  { name: "no-context-docs", type: "boolean" as const },
  { name: "provider", alias: "p", type: "string" as const },
  { name: "model", alias: "m", type: "string" as const },
  { name: "yes", alias: "y", type: "boolean" as const }
];

export async function runInitCommand(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const { flags, positionals } = parseArgs(argv, flagDefinitions);
  const cwdInput = (flags.cwd as string | undefined) ?? positionals[0];
  const targetDir = resolveWorkingDirectory(process.cwd(), cwdInput);
  await ensureDirectoryExists(targetDir);

  const userConfig = await readUserConfig();
  const normalize = (value?: string) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };
  const providerFlag = normalize(flags.provider as string | undefined);
  const modelFlag = normalize(flags.model as string | undefined);
  const resolvedProvider = providerFlag ?? normalize(process.env.CONTEXTCODE_PROVIDER) ?? normalize(userConfig.defaultProvider);
  const modelFlagInput = modelFlag ?? normalize(process.env.CONTEXTCODE_MODEL) ?? normalize(userConfig.defaultModel);
  let resolvedModel: string | undefined = modelFlagInput;

  if (resolvedProvider) {
    const normalizedModel = normalizeModelForProvider(resolvedProvider, modelFlagInput);
    if (normalizedModel.reason === "unknown-provider") {
      throw new ArgError(`Unknown provider: ${resolvedProvider}`);
    }
    if (!normalizedModel.model) {
      throw new ArgError(`Model missing for provider: ${resolvedProvider}`);
    }
    if (normalizedModel.reason === "fallback" && modelFlagInput) {
      console.warn(
        `[contextcode] Model "${modelFlagInput}" is not valid for provider "${resolvedProvider}". Falling back to "${normalizedModel.model}".`
      );
    }
    resolvedModel = normalizedModel.model;
  }

  const includeContextDocs = !(flags.noContextDocs as boolean | undefined);
  const extraOutputs = (flags.out as string[] | undefined) ?? [];
  const resolvedExtra = extraOutputs.map((p) => (path.isAbsolute(p) ? p : path.join(targetDir, p)));

  const indexingAnimation = animateSection("Indexing project...", INDEXING_ANIMATION_STEPS);
  let docAnimation: Promise<void> | null = null;
  let docAnimationStarted = false;
  let tokenStats: TokenUsage | undefined;

  const { index, outputs, contextScaffold, tokenUsage } = await buildIndexAndPersist(targetDir, {
    skipContextDocs: !includeContextDocs,
    outPaths: resolvedExtra,
    provider: resolvedProvider,
    model: resolvedProvider ? resolvedModel : undefined,
    providerOptions: resolvedProvider ? { config: userConfig } : undefined
  }, {
    onDocGenerationStart: () => {
      if (docAnimationStarted) return;
      docAnimationStarted = true;
      docAnimation = animateSection("Generating documentation...", buildDocAnimationSteps(includeContextDocs));
    },
    onDocGenerationComplete: ({ tokenUsage: usage }) => {
      tokenStats = usage;
    }
  });

  await indexingAnimation;
  if (docAnimation) {
    await docAnimation;
  }

  const usageToReport = tokenStats ?? tokenUsage;
  if (usageToReport) {
    printTokenCounter(usageToReport);
  }

  const gitRepo = isGitRepository(targetDir);
  if (!gitRepo) {
    console.warn(`⚠️  ${targetDir} is not a git repository. Some workflows may expect one.`);
  }

  if (contextScaffold) {
    await writeAgentLog(contextScaffold.agentLogDir, "init", {
      command: "init",
      cwd: targetDir,
      detectedStack: index.detectedStack,
      sampleCount: index.sampleFiles.length,
      outputs
    });
  }

  printSummary(targetDir, index.detectedStack, index.sampleFiles.slice(0, 5), outputs);
}

function printHelp() {
  console.log(`Usage: contextcode init [path] [options]\n\nOptions:\n  -C, --cwd <path>        Target directory (defaults to current)\n  --out <file>            Additional output path for index.json (repeatable)\n  --no-context-docs       Skip creating context-docs scaffold\n  -p, --provider <name>   AI provider for context generation (e.g., anthropic | gemini)\n  -m, --model <model>     Model to use (e.g., claude-sonnet-4-5 or gemini-3-pro-preview)\n  -y, --yes               Accept defaults silently\n  -h, --help              Show this help text`);
}

function printSummary(baseDir: string, stack: string[], sampleFiles: { path: string }[], outputs: string[]) {
  console.log(`Indexed repository: ${baseDir}`);
  console.log(`Detected stack: ${stack.length ? stack.join(", ") : "(none)"}`);
  if (sampleFiles.length) {
    console.log("Sample files:");
    for (const file of sampleFiles) {
      console.log(`  - ${file.path}`);
    }
  }
  console.log("Index written to:");
  for (const outPath of outputs) {
    const rel = path.relative(baseDir, outPath);
    const display = rel.startsWith("..") ? outPath : rel || ".";
    console.log(`  - ${display}`);
  }
}

const STEP_DELAY_MS = 160;
const numberFormatter = new Intl.NumberFormat("en-US");
const INDEXING_ANIMATION_STEPS = [
  "✓ Scanning files...",
  "✓ Parsing code structure",
  "✓ Analyzing dependencies",
  "✓ Resolving module links",
  "✓ Generating architecture map"
];

function buildDocAnimationSteps(includeDocs: boolean): string[] {
  if (!includeDocs) return [];
  return [
    "✓ Creating context.md",
    "✓ Creating features.md",
    "✓ Creating architecture.md",
    "✓ Creating implementation-guide.md"
  ];
}

function animateSection(title: string, steps: string[] | undefined | null): Promise<void> {
  if (!steps || !steps.length) {
    return Promise.resolve();
  }
  console.log(title);
  return (async () => {
    for (const line of steps) {
      await delay(STEP_DELAY_MS);
      console.log(line);
    }
    console.log("");
  })();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printTokenCounter(usage: TokenUsage) {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const total = usage.totalTokens ?? input + output;
  console.log(`Tokens used: in ${numberFormatter.format(input)} / out ${numberFormatter.format(output)} / total ${numberFormatter.format(total)}`);
  console.log("");
}

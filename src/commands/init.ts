import path from "node:path";
import fs from "fs/promises";
import { parseArgs, ArgError } from "../utils/args.js";
import { isGitRepository } from "../utils/git.js";
import { writeAgentLog } from "../shared/logs.js";
import { readUserConfig } from "../shared/user-config.js";

import { isInteractiveSession } from "../utils/prompt.js";
import { CONTEXT_DIR } from "../shared/constants.js";
import { normalizeModelForProvider } from "src/types/providers.js";
import { buildRepositoryIndex } from "src/agents/tools/indexer.js";
import { loadProvider } from "src/providers/provider.js";
import { generateContextDocs } from "src/agents/context-generator.js";

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

  const userConfig = await readUserConfig();
  const normalize = (value?: string) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const cwdFlag = normalize(flags.cwd as string | undefined);
  const targetDir = positionals[0]
    ? path.resolve(process.cwd(), positionals[0])
    : cwdFlag
    ? path.resolve(process.cwd(), cwdFlag)
    : process.cwd();

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
        `Model "${modelFlagInput}" is not valid for provider "${resolvedProvider}". Falling back to "${normalizedModel.model}".`
      );
    }
    resolvedModel = normalizedModel.model;
  }

  // Check if git repository
  const isGit = isGitRepository(targetDir);
  if (!isGit) {
    console.warn("Warning: Not a git repository. Some features may be limited.");
  }

  console.log(`Indexing repository at ${targetDir}...`);

  // Build the repository index using intelligent tools
  const index = await buildRepositoryIndex({
    targetDir,
    ignorePatterns: [],
    maxFiles: 10000,
    includeTests: false
  });

  // Create .context/ directory
  const contextDir = path.join(targetDir, CONTEXT_DIR);
  await fs.mkdir(contextDir, { recursive: true });

  console.log("\n✓ Repository analysis complete!");
  console.log(`  Detected stack: ${index.detectedStack.map(s => s.name).join(", ") || "none"}`);
  console.log(`  Workspace packages: ${index.workspacePackages.length}`);
  console.log(`  Indexed files: ${index.totalFiles}`);
  console.log(`  Important modules: ${index.modules.length}`);

  // Write agent log
  const agentLogDir = path.join(contextDir, ".agent-log");
  await fs.mkdir(agentLogDir, { recursive: true });
  await writeAgentLog(agentLogDir, "init", {
    command: "init",
    targetDir: path.relative(process.cwd(), targetDir),
    detectedStack: index.detectedStack.map(s => s.name),
    totalFiles: index.totalFiles,
    workspacePackages: index.workspacePackages.length
  });

  // Generate context docs with AI if provider is configured
  if (!flags["no-context-docs"]) {
    if (resolvedProvider && resolvedModel) {
      console.log("\nGenerating context documentation with AI...");

      try {
        const provider = await loadProvider(resolvedProvider, {
          cwd: targetDir,
          interactive: isInteractiveSession(),
          config: userConfig
        });

        const docs = await generateContextDocs(provider, resolvedModel, {
          targetDir,
          includeTests: false
        });

        // Write context docs
        await fs.writeFile(path.join(contextDir, "context.md"), docs, "utf8");

        console.log("\n✓ Context documentation generated:");
        console.log(`  - ${CONTEXT_DIR}/context.md`);
      } catch (error: any) {
        console.error(`\n✗ Failed to generate context docs: ${error.message}`);
        console.error("  The repository index was created successfully, but AI doc generation failed.");
      }
    } else {
      console.log("\nSkipping context doc generation (no provider configured).");
      console.log("Run `contextcode auth login` and `contextcode set provider` to enable AI-powered docs.");
    }
  }
}

function printHelp() {
  console.log(`Usage: contextcode init [path] [options]\n\nOptions:\n  -C, --cwd <path>        Target directory (defaults to current)\n  --out <file>            Additional output path for index.json (repeatable)\n  --no-context-docs       Skip creating context-docs scaffold\n  -p, --provider <name>   AI provider for context generation (e.g., anthropic | gemini)\n  -m, --model <model>     Model to use (e.g., claude-sonnet-4-5 or gemini-3-pro-preview)\n  -y, --yes               Accept defaults silently\n  -h, --help              Show this help text`);
}

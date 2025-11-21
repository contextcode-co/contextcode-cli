import path from "node:path";
import { parseArgs } from "../utils/args.js";
import { isGitRepository } from "../utils/git.js";
import { buildIndexAndPersist, ensureDirectoryExists, resolveWorkingDirectory } from "../shared/indexing.js";
import { writeAgentLog } from "../shared/logs.js";

const flagDefinitions = [
  { name: "cwd", alias: "C", type: "string" as const },
  { name: "out", type: "string" as const, multiple: true },
  { name: "no-context-docs", type: "boolean" as const },
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

  const includeContextDocs = !(flags.noContextDocs as boolean | undefined);
  const extraOutputs = (flags.out as string[] | undefined) ?? [];
  const resolvedExtra = extraOutputs.map((p) => (path.isAbsolute(p) ? p : path.join(targetDir, p)));

  const { index, outputs, contextScaffold } = await buildIndexAndPersist(targetDir, {
    skipContextDocs: !includeContextDocs,
    outPaths: resolvedExtra
  });

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
  console.log(`Usage: contextcode init [path] [options]\n\nOptions:\n  -C, --cwd <path>        Target directory (defaults to current)\n  --out <file>            Additional output path for index.json (repeatable)\n  --no-context-docs       Skip creating context-docs scaffold\n  -y, --yes               Accept defaults silently\n  -h, --help              Show this help text`);
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

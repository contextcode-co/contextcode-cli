import path from "node:path";
import type { IndexResult, WorkspacePackage, RepoScript } from "../indexer.js";

const MAX_PACKAGE_ROWS = 8;
const MAX_COMMAND_ROWS = 8;
const MAX_PACKAGE_COMMANDS = 3;
const MAX_DIR_ROWS = 10;

export type ContextSummaryOptions = {
  repoName?: string;
};

export function renderContextMarkdown(index: IndexResult, options: ContextSummaryOptions = {}): string {
  const repoName = options.repoName ?? index.packageJson?.name ?? "this repository";
  const lines: string[] = [];

  lines.push("# context.md", "");
  lines.push(
    `This guide helps any AI assistant (Claude, GitHub Copilot, Cursor, etc.) work effectively inside **${repoName}** without scanning the entire codebase.`
  );
  lines.push("");

  lines.push("## Architecture", "");
  const architectureRows = buildArchitectureRows(index.workspacePackages);
  if (architectureRows.length) {
    lines.push(...architectureRows);
  } else {
    lines.push("- Monorepo detected. Refer to packages/ for individual services and CLIs.");
  }
  lines.push("");

  lines.push("## Detected Stack", "");
  if (index.detectedStack.length) {
    lines.push(`- ${index.detectedStack.join(", ")}`);
  } else {
    lines.push("- Stack heuristics unavailable. Inspect package.json dependencies for details.");
  }
  lines.push("");

  lines.push("## Development Commands", "");
  const rootCommands = buildCommandBlock(index.rootScripts, "Root workspace (run from repo root)");
  if (rootCommands.length) {
    lines.push(...rootCommands);
    lines.push("");
  }
  const packageCommands = buildPackageCommandBlocks(index.workspacePackages);
  if (packageCommands.length) {
    lines.push(...packageCommands);
  }
  if (!rootCommands.length && !packageCommands.length) {
    lines.push("- No scripts found. Add npm/pnpm scripts to share common workflows.");
  }
  lines.push("");

  lines.push("## Key Directories", "");
  const dirRows = buildDirectoryRows(index.importantPaths);
  if (dirRows.length) {
    lines.push(...dirRows);
  } else {
    lines.push("- Refer to src/ and packages/ for source files.");
  }
  lines.push("");

  lines.push("## Working With This Repo", "");
  lines.push(
    "1. Use the commands above to set up dev servers, run tests, or generate builds.",
    "2. When asking an AI assistant for help, cite the package path (for example `packages/tui` or `src/commands/auth.ts`).",
    "3. If the assistant needs implementation details, open only the referenced files instead of the whole repo to stay within token limits.",
    "4. After large refactors, rerun `contextcode init` so this file stays accurate."
  );
  lines.push("");

  lines.push("## Search Tips", "");
  lines.push(
    "- Start with `git grep '<keyword>'` or `rg '<keyword>'` scoped to the directories listed above.",
    "- Prefer smaller files or specific packages before loading monolithic files.",
    "- Mention file paths and line numbers when giving instructions to another AI agent."
  );

  return lines.join("\n");
}

function buildArchitectureRows(packages: WorkspacePackage[]): string[] {
  if (!packages.length) return [];
  return packages.slice(0, MAX_PACKAGE_ROWS).map((pkg) => `- **${pkg.name}** (${pkg.relativeDir}) — ${describePackage(pkg)}`);
}

function describePackage(pkg: WorkspacePackage): string {
  const tags = detectPackageTags(pkg);
  const snippets: string[] = [];
  if (pkg.description) snippets.push(pkg.description.trim());
  if (tags.length) snippets.push(tags.join(", "));
  if (!snippets.length) snippets.push("workspace package");
  return clamp(snippets.join(" — "), 220);
}

function detectPackageTags(pkg: WorkspacePackage): string[] {
  const deps = new Set([...pkg.dependencies, ...pkg.devDependencies].map((d) => d.toLowerCase()));
  const tags: string[] = [];
  const tagMap: Array<[string, string]> = [
    ["next", "Next.js frontend"],
    ["react", "React UI"],
    ["ink", "Ink terminal UI"],
    ["nest", "NestJS backend"],
    ["express", "Express server"],
    ["fastify", "Fastify server"],
    ["prisma", "Prisma ORM"],
    ["typeorm", "TypeORM"],
    ["zod", "Zod validation"],
    ["tsup", "Bundled with tsup"],
    ["tsx", "TSX runtime"],
    ["vitest", "Vitest"],
    ["jest", "Jest tests"],
    ["redux", "Redux state"],
    ["tanstack", "TanStack Query"]
  ];
  for (const [needle, label] of tagMap) {
    if (Array.from(deps).some((dep) => dep.includes(needle))) {
      tags.push(label);
    }
  }
  return tags.slice(0, 3);
}

function buildCommandBlock(scripts: RepoScript[], heading: string): string[] {
  if (!scripts.length) return [];
  const lines: string[] = [];
  lines.push(`### ${heading}`);
  lines.push("```bash");
  scripts.slice(0, MAX_COMMAND_ROWS).forEach((script) => {
    lines.push(`# ${script.command}`);
    lines.push(`pnpm run ${script.name}`);
    lines.push("");
  });
  lines.push("```");
  return lines;
}

function buildPackageCommandBlocks(packages: WorkspacePackage[]): string[] {
  const rows: string[] = [];
  packages.forEach((pkg) => {
    if (!pkg.scripts.length) return;
    rows.push(`### ${pkg.name} (${pkg.relativeDir})`);
    rows.push("```bash");
    pkg.scripts.slice(0, MAX_PACKAGE_COMMANDS).forEach((script) => {
      const suggestion = `pnpm --filter ${pkg.name} ${script.name}`;
      rows.push(`# ${script.command}`);
      rows.push(suggestion);
    });
    rows.push("```");
    rows.push("");
  });
  return rows;
}

function buildDirectoryRows(paths: string[]): string[] {
  if (!paths.length) return [];
  return paths.slice(0, MAX_DIR_ROWS).map((p) => `- \`${normalizePath(p)}\``);
}

function normalizePath(p: string) {
  return p.split(path.sep).join("/");
}

function clamp(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

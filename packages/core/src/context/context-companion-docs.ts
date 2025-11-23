import type { IndexResult, WorkspacePackage, RepoScript } from "../indexer.js";

const MAX_FEATURE_PACKAGES = 6;
const MAX_SAMPLE_FILES = 6;
const MAX_ARCH_PACKAGES = 10;
const MAX_DEP_ROWS = 12;
const MAX_PACKAGE_SCRIPTS = 3;

export type CompanionDocOptions = {
  repoName?: string;
};

export function renderFeaturesGuide(index: IndexResult, options: CompanionDocOptions = {}): string {
  const repoName = resolveRepoName(index, options);
  const lines: string[] = [];

  lines.push(`# Feature Overview - ${repoName}`);
  lines.push("", "Use this document to quickly convey what the product offers and where each capability lives inside the repo.", "");

  lines.push("## Workspace Highlights", "");
  const featurePackages = index.workspacePackages.slice(0, MAX_FEATURE_PACKAGES);
  if (featurePackages.length) {
    featurePackages.forEach((pkg) => {
      lines.push(`### ${pkg.name} (${pkg.relativeDir})`);
      if (pkg.description) {
        lines.push(pkg.description.trim());
      }
      const focus = describePackageFocus(pkg);
      if (focus) {
        lines.push(`- Focus: ${focus}`);
      }
      const scripts = summarizeScripts(pkg.scripts, MAX_PACKAGE_SCRIPTS);
      if (scripts.length) {
        lines.push(`- Key scripts: ${scripts.join(", ")}`);
      }
      const deps = summarizeDependencies(pkg.dependencies);
      if (deps.length) {
        lines.push(`- Dependencies: ${deps.join(", ")}`);
      }
      if (pkg.keywords.length) {
        lines.push(`- Keywords: ${pkg.keywords.slice(0, 6).join(", ")}`);
      }
      lines.push("");
    });
  } else {
    lines.push("- No workspace packages detected. Features live directly under src/.", "");
  }

  lines.push("## Capabilities & Signals", "");
  const capabilityLines = buildCapabilityLines(index);
  if (capabilityLines.length) {
    lines.push(...capabilityLines, "");
  } else {
    lines.push("- Capabilities inferred after dependencies are installed.", "");
  }

  lines.push("## Sample Files To Explore", "");
  const sampleFiles = index.sampleFiles.slice(0, MAX_SAMPLE_FILES);
  if (sampleFiles.length) {
    sampleFiles.forEach((file) => {
        lines.push(`- \`${file.path}\``);
    });
    lines.push("");
  } else {
    lines.push("- Run `contextcode init` after adding representative files.", "");
  }

  lines.push("## Suggested Next Experiments", "");
  lines.push(
    "1. Pair an AI assistant with the package summaries above to draft feature briefs.",
    "2. Use the sample files list as seed context when exploring unfamiliar code.",
    "3. Keep this document updated whenever a new package or capability ships."
  );

  return lines.join("\n");
}

export function renderArchitectureGuide(index: IndexResult, options: CompanionDocOptions = {}): string {
  const repoName = resolveRepoName(index, options);
  const lines: string[] = [];

  lines.push(`# Architecture - ${repoName}`);
  lines.push("", "High-level map of packages, shared tooling, and directory conventions.", "");

  lines.push("## Monorepo Layout", "");
  const packages = index.workspacePackages.slice(0, MAX_ARCH_PACKAGES);
  if (packages.length) {
    packages.forEach((pkg) => {
      const summary = describePackageFocus(pkg) || "workspace package";
      lines.push(`- **${pkg.name}** (${pkg.relativeDir}) - ${summary}`);
    });
    lines.push("");
  } else {
    lines.push("- Single-package repo. Inspect src/ for feature areas.", "");
  }

  lines.push("## Shared Tooling", "");
  const toolingLines = buildToolingLines(index);
  if (toolingLines.length) {
    lines.push(...toolingLines, "");
  } else {
    lines.push("- Tooling inferred from package.json dependencies.", "");
  }

  lines.push("## Directory Map", "");
  if (index.importantPaths.length) {
    index.importantPaths.slice(0, 12).forEach((dir) => {
        lines.push(`- \`${dir}\``);
    });
    lines.push("");
  } else {
    lines.push("- Additional directory hints will appear after more files are indexed.", "");
  }

  lines.push("## Execution Paths", "");
  const commandLines = buildCommandLines(index.rootScripts);
  if (commandLines.length) {
    lines.push(...commandLines);
  } else {
    lines.push("- Define npm/pnpm scripts to document how to run the system.");
  }

  return lines.join("\n");
}

export function renderImplementationGuide(index: IndexResult, options: CompanionDocOptions = {}): string {
  const repoName = resolveRepoName(index, options);
  const manager = detectPackageManager(index.packageJson?.packageManager);
  const installCmd = `${manager.install}`;
  const runScript = (script: string) => manager.run(script);
  const lines: string[] = [];

  lines.push(`# Implementation Guide - ${repoName}`);
  lines.push("", "Checklist for setting up, running, and verifying changes locally.", "");

  lines.push("## Prerequisites", "");
  if (index.packageJson?.engines?.node) {
    lines.push(`- Node.js ${index.packageJson.engines.node}`);
  }
  lines.push(`- Package manager: ${manager.label}`);
  lines.push("- Clone the repository and ensure dependencies are installed.", "");

  lines.push("## Setup", "");
  lines.push("1. Install dependencies:");
  lines.push("   ```bash", `   ${installCmd}`, "   ```");
  const buildScript = findScript(index.rootScripts, "build");
  if (buildScript) {
    lines.push("2. Build once to warm caches:");
    lines.push("   ```bash", `   ${runScript(buildScript.name)}`, "   ```");
  }
  const devScript = findScript(index.rootScripts, "dev");
  if (devScript) {
    lines.push("3. Start the development server:");
    lines.push("   ```bash", `   ${runScript(devScript.name)}`, "   ```");
  }
  lines.push("");

  lines.push("## Common Commands", "");
  const commands = buildCommandLines(index.rootScripts);
  if (commands.length) {
    lines.push(...commands, "");
  } else {
    lines.push("- Define scripts in package.json to document workflows.", "");
  }

  lines.push("## Package Workflows", "");
  if (index.workspacePackages.length) {
    index.workspacePackages.slice(0, 6).forEach((pkg) => {
      const scripts = summarizeScripts(pkg.scripts, 2);
      if (!scripts.length) return;
      lines.push(`- ${pkg.name}: ${scripts.map((script) => manager.filter(pkg.name, script)).join(", ")}`);
    });
    lines.push("");
  } else {
    lines.push("- Run commands from the repo root; no nested workspaces detected.", "");
  }

  lines.push("## Verification", "");
  const testScript = findScript(index.rootScripts, "test");
  if (testScript) {
    lines.push("- Run the automated test suite before committing:");
    lines.push("  ```bash", `  ${runScript(testScript.name)}`, "  ```");
  } else {
    lines.push("- Add a `test` script to codify verification steps.");
  }

  lines.push("\n## Collaboration Tips", "");
  lines.push(
    "- Re-run `contextcode init` after major refactors to refresh all docs.",
    "- Reference the generated features and architecture guides when opening PRs.",
    "- Keep scripts and package descriptions up to date so AI assistants stay accurate."
  );

  return lines.join("\n");
}

function resolveRepoName(index: IndexResult, options: CompanionDocOptions) {
  return options.repoName ?? index.packageJson?.name ?? "this repository";
}

function describePackageFocus(pkg: WorkspacePackage) {
  const tags = detectPackageTags(pkg);
  if (pkg.description && tags.length) {
    return `${pkg.description.trim()} - ${tags.join(", ")}`;
  }
  if (pkg.description) return pkg.description.trim();
  if (tags.length) return tags.join(", ");
  return "";
}

function detectPackageTags(pkg: WorkspacePackage) {
  const deps = new Set([...pkg.dependencies, ...pkg.devDependencies].map((d) => d.toLowerCase()));
  const tags: string[] = [];
  const tagMap: Array<[string, string]> = [
    ["next", "Next.js"],
    ["react", "React"],
    ["ink", "Ink TUI"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["prisma", "Prisma"],
    ["typeorm", "TypeORM"],
    ["vitest", "Vitest"],
    ["jest", "Jest"],
    ["tsup", "tsup build"],
    ["tsx", "tsx runtime"],
    ["zod", "Zod validation"]
  ];
  for (const [needle, label] of tagMap) {
    if (Array.from(deps).some((dep) => dep.includes(needle))) {
      tags.push(label);
    }
  }
  return tags.slice(0, 3);
}

function summarizeScripts(scripts: RepoScript[], limit: number) {
  return scripts.slice(0, limit).map((script) => script.name);
}

function summarizeDependencies(deps: string[], limit = 5) {
  return deps.slice(0, limit);
}

function buildCapabilityLines(index: IndexResult) {
  const lines: string[] = [];
  if (index.detectedStack.length) {
    lines.push(`- Stack: ${index.detectedStack.join(", ")}`);
  }
  const keywords = collectKeywords(index.workspacePackages);
  if (keywords.length) {
    lines.push(`- Keywords: ${keywords.join(", ")}`);
  }
  return lines;
}

function collectKeywords(packages: WorkspacePackage[]) {
  const set = new Set<string>();
  packages.forEach((pkg) => {
    pkg.keywords.slice(0, 8).forEach((kw) => set.add(kw));
  });
  return Array.from(set).slice(0, 12);
}

function buildToolingLines(index: IndexResult) {
  const lines: string[] = [];
  if (index.detectedStack.length) {
    lines.push(`- Application stack: ${index.detectedStack.join(", ")}`);
  }
  const deps = Object.keys(index.packageJson?.dependencies ?? {});
  const devDeps = Object.keys(index.packageJson?.devDependencies ?? {});
  const combined = [...deps, ...devDeps];
  if (combined.length) {
    lines.push(`- Shared libraries: ${combined.slice(0, MAX_DEP_ROWS).join(", ")}`);
  }
  const scripts = summarizeScripts(index.rootScripts, 4);
  if (scripts.length) {
    lines.push(`- Root scripts: ${scripts.join(", ")}`);
  }
  return lines;
}

function buildCommandLines(scripts: RepoScript[]) {
  if (!scripts.length) return [];
  const lines: string[] = [];
  lines.push("```bash");
  scripts.slice(0, MAX_DEP_ROWS).forEach((script) => {
    lines.push(`# ${script.command}`);
    lines.push(`pnpm run ${script.name}`);
    lines.push("");
  });
  lines.push("```");
  return lines;
}

function detectPackageManager(value?: string) {
  if (value?.startsWith("bun")) {
    return createManager("bun", "bun install", (script) => `bun run ${script}`, (pkg, script) => `bun --filter ${pkg} ${script}`);
  }
  if (value?.startsWith("yarn")) {
    return createManager("yarn", "yarn", (script) => `yarn ${script}`, (pkg, script) => `yarn workspace ${pkg} ${script}`);
  }
  if (value?.startsWith("npm")) {
    return createManager("npm", "npm install", (script) => `npm run ${script}`, (pkg, script) => `npm run ${script} --workspace ${pkg}`);
  }
  return createManager("pnpm", "pnpm install", (script) => `pnpm run ${script}`, (pkg, script) => `pnpm --filter ${pkg} ${script}`);
}

function createManager(label: string, install: string, run: (script: string) => string, filter: (pkg: string, script: string) => string) {
  return { label, install, run, filter };
}

function findScript(scripts: RepoScript[], name: string) {
  return scripts.find((script) => script.name === name);
}

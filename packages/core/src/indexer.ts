import fs from "fs/promises";
import path from "path";
import { globby } from "globby";

const DEFAULT_IGNORE = ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.next/**", "**/.turbo/**", "**/.cache/**"];
const WORKSPACE_PATTERNS = [
  "packages/*/package.json",
  "apps/*/package.json",
  "services/*/package.json",
  "extensions/*/package.json",
  "cli/*/package.json"
];
const MAX_WORKSPACE_PACKAGES = 12;
const MAX_SCRIPTS = 12;

export type RepoScript = {
  name: string;
  command: string;
};

export type WorkspacePackage = {
  name: string;
  relativeDir: string;
  description?: string;
  scripts: RepoScript[];
  dependencies: string[];
  devDependencies: string[];
  keywords: string[];
};

export type IndexResult = {
  packageJson?: any;
  detectedStack: string[];
  sampleFiles: { path: string; excerpt: string }[];
  workspacePackages: WorkspacePackage[];
  rootScripts: RepoScript[];
  importantPaths: string[];
  scannedFileCount: number;
};

async function readJsonSafe(p: string) {
  try {
    const txt = await fs.readFile(p, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export async function indexRepo(cwd: string): Promise<IndexResult> {
  const pkgPath = path.join(cwd, "package.json");
  const packageJson = await readJsonSafe(pkgPath);

  // find representative files (ignore node_modules, dist, .git)
  const patterns = [
    "package.json",
    "tsconfig.json",
    "prisma/schema.prisma",
    "next.config.*",
    "Dockerfile",
    "src/**/*.{ts,tsx,js,jsx}",
    "README.md"
  ];
  const paths = await globby(patterns, {
    cwd,
    gitignore: true,
    ignore: DEFAULT_IGNORE
  });

  const sampleFiles = await Promise.all(
    paths.slice(0, 30).map(async (p) => {
      const full = path.join(cwd, p);
      try {
        const txt = await fs.readFile(full, "utf8");
        const lines = txt.split("\n").slice(0, 80).join("\n");
        return { path: p, excerpt: lines };
      } catch {
        return { path: p, excerpt: "" };
      }
    })
  );

  const detectedStack: string[] = [];
  const deps = packageJson?.dependencies ?? {};
  const devDeps = packageJson?.devDependencies ?? {};
  const allDeps = { ...deps, ...devDeps };

  const heuristics = [
    ["next", "Next.js"],
    ["react", "React"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["prisma", "Prisma"],
    ["typeorm", "TypeORM"]
  ];

  for (const [k, label] of heuristics) {
    if (allDeps[k]) detectedStack.push(label);
  }

  const workspacePackages = await discoverWorkspacePackages(cwd);
  const rootScripts = extractScripts(packageJson?.scripts ?? {});
  const importantPaths = deriveImportantPaths(sampleFiles);

  return {
    packageJson,
    detectedStack,
    sampleFiles,
    workspacePackages,
    rootScripts,
    importantPaths,
    scannedFileCount: paths.length
  };
}

async function discoverWorkspacePackages(cwd: string): Promise<WorkspacePackage[]> {
  const packageGlobs = await globby(WORKSPACE_PATTERNS, {
    cwd,
    gitignore: true,
    ignore: DEFAULT_IGNORE
  });

  const seen = new Set<string>();
  const workspaces: WorkspacePackage[] = [];

  for (const rel of packageGlobs) {
    const dir = path.dirname(rel);
    if (!dir || dir === "." || seen.has(dir)) continue;
    seen.add(dir);

    if (workspaces.length >= MAX_WORKSPACE_PACKAGES) break;

    const abs = path.join(cwd, rel);
    try {
      const data = await readJsonSafe(abs);
      if (!data?.name) continue;
      workspaces.push({
        name: data.name,
        relativeDir: dir,
        description: data.description,
        scripts: extractScripts(data.scripts ?? {}),
        dependencies: Object.keys(data.dependencies ?? {}),
        devDependencies: Object.keys(data.devDependencies ?? {}),
        keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 12) : []
      });
    } catch {
      // ignore unreadable package
    }
  }

  return workspaces;
}

function extractScripts(scripts: Record<string, string>): RepoScript[] {
  return Object.entries(scripts)
    .slice(0, MAX_SCRIPTS)
    .map(([name, command]) => ({ name, command }));
}

function deriveImportantPaths(sampleFiles: { path: string }[]): string[] {
  const paths = new Set<string>();
  for (const file of sampleFiles) {
    const dir = path.dirname(file.path);
    if (dir && dir !== ".") paths.add(dir);
    if (paths.size >= 20) break;
  }
  return Array.from(paths);
}

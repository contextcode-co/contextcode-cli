import fs from "fs/promises";
import path from "path";
import { globby } from "globby";

export type IndexResult = {
  packageJson?: any;
  detectedStack: string[];
  sampleFiles: { path: string; excerpt: string }[];
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
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.next/**"]
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

  return {
    packageJson,
    detectedStack,
    sampleFiles
  };
}

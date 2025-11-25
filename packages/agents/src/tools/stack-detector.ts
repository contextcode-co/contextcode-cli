import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StackTechnology } from "@contextcode/types";

type DetectionRule = {
  files: string[];
  keywords?: string[];
  technology: Omit<StackTechnology, "confidence">;
};

const STACK_DETECTION_RULES: DetectionRule[] = [
  // JavaScript/TypeScript ecosystem
  { files: ["package.json"], technology: { name: "Node.js", category: "runtime" } },
  { files: ["tsconfig.json"], technology: { name: "TypeScript", category: "language" } },
  { files: ["bun.lockb"], technology: { name: "Bun", category: "runtime" } },
  { files: ["deno.json", "deno.jsonc"], technology: { name: "Deno", category: "runtime" } },

  // Package managers
  { files: ["pnpm-lock.yaml"], technology: { name: "pnpm", category: "tool" } },
  { files: ["yarn.lock"], technology: { name: "Yarn", category: "tool" } },
  { files: ["package-lock.json"], technology: { name: "npm", category: "tool" } },
  { files: ["bun.lockb"], technology: { name: "Bun", category: "tool" } },

  // Frontend frameworks
  { files: ["next.config.js", "next.config.mjs", "next.config.ts"], technology: { name: "Next.js", category: "framework" } },
  { files: ["nuxt.config.js", "nuxt.config.ts"], technology: { name: "Nuxt", category: "framework" } },
  { files: ["vite.config.js", "vite.config.ts"], technology: { name: "Vite", category: "tool" } },
  { files: ["svelte.config.js"], technology: { name: "Svelte", category: "framework" } },
  { files: ["astro.config.mjs"], technology: { name: "Astro", category: "framework" } },
  { files: ["remix.config.js"], technology: { name: "Remix", category: "framework" } },

  // Backend frameworks
  { files: ["nest-cli.json"], technology: { name: "NestJS", category: "framework" } },
  { files: ["fastify.config.js"], technology: { name: "Fastify", category: "framework" } },

  // Build tools
  { files: ["webpack.config.js", "webpack.config.ts"], technology: { name: "Webpack", category: "tool" } },
  { files: ["rollup.config.js"], technology: { name: "Rollup", category: "tool" } },
  { files: ["esbuild.config.js"], technology: { name: "esbuild", category: "tool" } },
  { files: ["tsup.config.ts"], technology: { name: "tsup", category: "tool" } },

  // Testing
  { files: ["jest.config.js", "jest.config.ts"], technology: { name: "Jest", category: "tool" } },
  { files: ["vitest.config.ts"], technology: { name: "Vitest", category: "tool" } },
  { files: ["playwright.config.ts"], technology: { name: "Playwright", category: "tool" } },
  { files: ["cypress.config.js"], technology: { name: "Cypress", category: "tool" } },

  // Python
  { files: ["requirements.txt", "pyproject.toml"], technology: { name: "Python", category: "language" } },
  { files: ["setup.py"], technology: { name: "Python", category: "language" } },
  { files: ["Pipfile"], technology: { name: "Pipenv", category: "tool" } },
  { files: ["poetry.lock"], technology: { name: "Poetry", category: "tool" } },
  { files: ["manage.py"], technology: { name: "Django", category: "framework" } },
  { files: ["flask_app.py", "app.py"], keywords: ["from flask import"], technology: { name: "Flask", category: "framework" } },

  // Go
  { files: ["go.mod"], technology: { name: "Go", category: "language" } },
  { files: ["go.sum"], technology: { name: "Go", category: "language" } },

  // Rust
  { files: ["Cargo.toml"], technology: { name: "Rust", category: "language" } },
  { files: ["Cargo.lock"], technology: { name: "Cargo", category: "tool" } },

  // Ruby
  { files: ["Gemfile"], technology: { name: "Ruby", category: "language" } },
  { files: ["config/application.rb"], technology: { name: "Ruby on Rails", category: "framework" } },

  // PHP
  { files: ["composer.json"], technology: { name: "PHP", category: "language" } },
  { files: ["artisan"], technology: { name: "Laravel", category: "framework" } },
  { files: ["wp-config.php", "wp-load.php"], technology: { name: "WordPress", category: "platform" } },
  { files: ["style.css"], keywords: ["Theme Name:", "Template:"], technology: { name: "WordPress Theme", category: "platform" } },

  // Java/JVM
  { files: ["pom.xml"], technology: { name: "Maven", category: "tool" } },
  { files: ["build.gradle", "build.gradle.kts"], technology: { name: "Gradle", category: "tool" } },

  // Databases
  { files: ["prisma/schema.prisma"], technology: { name: "Prisma", category: "database" } },
  { files: ["drizzle.config.ts"], technology: { name: "Drizzle", category: "database" } },

  // Docker
  { files: ["Dockerfile"], technology: { name: "Docker", category: "tool" } },
  { files: ["docker-compose.yml", "docker-compose.yaml"], technology: { name: "Docker Compose", category: "tool" } },

  // Monorepo tools
  { files: ["pnpm-workspace.yaml"], technology: { name: "pnpm Workspaces", category: "tool" } },
  { files: ["lerna.json"], technology: { name: "Lerna", category: "tool" } },
  { files: ["nx.json"], technology: { name: "Nx", category: "tool" } },
  { files: ["turbo.json"], technology: { name: "Turborepo", category: "tool" } }
];

export function detectStack(targetDir: string): StackTechnology[] {
  const detected: StackTechnology[] = [];

  for (const rule of STACK_DETECTION_RULES) {
    let matched = false;
    let confidence = 1.0;

    // Check file existence
    for (const file of rule.files) {
      const fullPath = path.join(targetDir, file);
      if (existsSync(fullPath)) {
        matched = true;

        // If keywords are specified, check content
        if (rule.keywords && rule.keywords.length > 0) {
          try {
            const content = readFileSync(fullPath, "utf8");
            const keywordMatch = rule.keywords.some(keyword => content.includes(keyword));
            if (!keywordMatch) {
              confidence = 0.6; // Lower confidence if keywords don't match
            }
          } catch {
            confidence = 0.7; // File exists but couldn't read
          }
        }

        break;
      }
    }

    if (matched) {
      detected.push({
        ...rule.technology,
        confidence
      });
    }
  }

  // Detect version from package.json if available
  const pkgPath = path.join(targetDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

      // Extract versions for Node-based tech
      if (pkg.engines?.node) {
        const nodeEntry = detected.find(t => t.name === "Node.js");
        if (nodeEntry) {
          nodeEntry.version = pkg.engines.node;
        }
      }

      // Detect React
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        const version = pkg.dependencies?.react || pkg.devDependencies?.react;
        detected.push({
          name: "React",
          version: version?.replace(/^[\^~]/, ""),
          category: "framework",
          confidence: 1.0
        });
      }

      // Detect Vue
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        const version = pkg.dependencies?.vue || pkg.devDependencies?.vue;
        detected.push({
          name: "Vue",
          version: version?.replace(/^[\^~]/, ""),
          category: "framework",
          confidence: 1.0
        });
      }

      // Detect Express
      if (pkg.dependencies?.express || pkg.devDependencies?.express) {
        detected.push({
          name: "Express",
          category: "framework",
          confidence: 1.0
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  return detected;
}

export function extractVersionFromPackageJson(targetDir: string, packageName: string): string | undefined {
  const pkgPath = path.join(targetDir, "package.json");
  if (!existsSync(pkgPath)) return undefined;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const version = pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName];
    return version?.replace(/^[\^~]/, "");
  } catch {
    return undefined;
  }
}

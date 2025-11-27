import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { globby } from "globby";
import type {
  RepositoryIndex,
  IndexerConfig,
  FileMetadata,
  ModuleMap,
  WorkspacePackage,
  StackTechnology,
  SpecialFile,
  CodeInsights
} from "src/types/index.js";
import { detectStack } from "./stack-detector.js";
import {
  shouldIgnorePath,
  categorizeFile,
  calculateFileImportance,
  isSourceFile
} from "./file-filter.js";
import {
  extractKeywordsFromFile,
  extractExports,
  extractDependencies
} from "./keyword-extractor.js";
import { findSpecialFiles } from "./special-files.js";
import {
  discoverKeyPatterns,
  findEntryPoints,
  findConfigurationPatterns
} from "./ripgrep-search.js";

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MAX_KEYWORD_CONTENT_SIZE = 50 * 1024; // 50KB for keyword extraction

export async function buildRepositoryIndex(config: IndexerConfig): Promise<RepositoryIndex> {
  const { targetDir, ignorePatterns = [], maxFiles = 10000, includeTests = false } = config;

  console.log("[indexer] Detecting stack...");
  const detectedStack = detectStack(targetDir);
  const stackNames = detectedStack.map(s => s.name.toLowerCase());

  const isWordPressTheme = detectedStack.some(
    s => s.name === "WordPress Theme" || s.name === "WordPress"
  );

  console.log("[indexer] Scanning workspace packages...");
  const workspacePackages = await discoverWorkspacePackages(targetDir);

  console.log("[indexer] Scanning for special documentation files...");
  const specialFiles = await findSpecialFiles(targetDir);

  console.log("[indexer] Scanning files...");
  const filterContext = {
    isWordPressTheme,
    hasNodeModules: existsSync(path.join(targetDir, "node_modules")),
    detectedStack: stackNames
  };

  // Build ignore patterns
  const allIgnorePatterns = [
    ...ignorePatterns,
    "**/.git/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**"
  ];

  // For WordPress themes, be more selective
  if (isWordPressTheme) {
    allIgnorePatterns.push(
      "**/vendor/**",
      "**/assets/vendor/**"
    );
  }

  const allFiles = await globby("**/*", {
    cwd: targetDir,
    absolute: false,
    gitignore: true,
    ignore: allIgnorePatterns,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  console.log(`[indexer] Found ${allFiles.length} files after filtering`);

  const fileMetadata: FileMetadata[] = [];
  const importantPaths: string[] = [];
  let processedCount = 0;

  for (const relativePath of allFiles) {
    if (processedCount >= maxFiles) {
      console.warn(`[indexer] Reached max files limit (${maxFiles}), stopping scan`);
      break;
    }

    if (shouldIgnorePath(relativePath, filterContext, ignorePatterns)) {
      continue;
    }

    const category = categorizeFile(relativePath);

    // Skip tests unless explicitly included
    if (category === "test" && !includeTests) {
      continue;
    }

    const fullPath = path.join(targetDir, relativePath);
    const stats = tryStatSync(fullPath);
    if (!stats || stats.size > MAX_FILE_SIZE) {
      continue;
    }

    const importance = calculateFileImportance(relativePath, filterContext);

    // Only process important files for keywords
    let keywords: string[] = [];
    let exports: string[] = [];
    let dependencies: string[] = [];

    if (importance > 0.4 || category === "config") {
      const content = stats.size < MAX_KEYWORD_CONTENT_SIZE ? tryReadFileSync(fullPath) : null;

      if (content) {
        keywords = extractKeywordsFromFile(fullPath, content);
        exports = extractExports(fullPath, content);
        dependencies = extractDependencies(fullPath, content);
      }
    }

    fileMetadata.push({
      path: relativePath,
      type: category,
      keywords,
      importance,
      exports: exports.length > 0 ? exports : undefined,
      dependencies: dependencies.length > 0 ? dependencies : undefined
    });

    // Track important paths
    if (importance > 0.7 || category === "config") {
      importantPaths.push(relativePath);
    }

    processedCount++;
  }

  console.log(`[indexer] Indexed ${processedCount} files`);
  console.log("[indexer] Grouping files into modules...");
  const modules = buildModuleMap(fileMetadata, targetDir);

  console.log("[indexer] Discovering code patterns with ripgrep...");
  const codeInsights = await discoverCodeInsights(targetDir);

  return {
    detectedStack,
    workspacePackages,
    importantPaths,
    modules,
    fileMetadata,
    specialFiles,
    codeInsights,
    ignoredPatterns: allIgnorePatterns,
    totalFiles: processedCount,
    indexedAt: new Date().toISOString()
  };
}

async function discoverCodeInsights(targetDir: string): Promise<CodeInsights> {
  try {
    const [entryPoints, patterns, configPatterns] = await Promise.all([
      findEntryPoints(targetDir),
      discoverKeyPatterns(targetDir),
      findConfigurationPatterns(targetDir)
    ]);

    return {
      entryPoints,
      patterns,
      configPatterns
    };
  } catch (error) {
    console.warn("[indexer] Failed to discover code patterns:", error);
    return {
      entryPoints: [],
      patterns: [],
      configPatterns: []
    };
  }
}

async function discoverWorkspacePackages(targetDir: string): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];

  // Check root package.json
  const rootPkgPath = path.join(targetDir, "package.json");
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
      packages.push({
        name: rootPkg.name || "root",
        version: rootPkg.version,
        relativeDir: ".",
        description: rootPkg.description,
        isWorkspaceRoot: true
      });

      // Check for workspace configuration
      const workspaceGlobs = rootPkg.workspaces || [];
      if (Array.isArray(workspaceGlobs)) {
        const packageJsonPaths = await globby(
          workspaceGlobs.map(g => `${g}/package.json`),
          {
            cwd: targetDir,
            absolute: false
          }
        );

        for (const pkgPath of packageJsonPaths) {
          try {
            const fullPath = path.join(targetDir, pkgPath);
            const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
            const relativeDir = path.dirname(pkgPath);

            packages.push({
              name: pkg.name || relativeDir,
              version: pkg.version,
              relativeDir,
              description: pkg.description,
              isWorkspaceRoot: false
            });
          } catch {
            // Skip invalid package.json
          }
        }
      }
    } catch {
      // Ignore invalid root package.json
    }
  }

  // Check pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(targetDir, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    try {
      const content = readFileSync(pnpmWorkspacePath, "utf8");
      const packageDirs = content
        .split("\n")
        .filter(line => line.trim().startsWith("-"))
        .map(line => line.replace(/^-\s*['"]?([^'"]+)['"]?/, "$1").trim());

      for (const dir of packageDirs) {
        const packageJsonPaths = await globby(`${dir}/package.json`, {
          cwd: targetDir,
          absolute: false
        });

        for (const pkgPath of packageJsonPaths) {
          if (!packages.some(p => p.relativeDir === path.dirname(pkgPath))) {
            try {
              const fullPath = path.join(targetDir, pkgPath);
              const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
              const relativeDir = path.dirname(pkgPath);

              packages.push({
                name: pkg.name || relativeDir,
                version: pkg.version,
                relativeDir,
                description: pkg.description,
                isWorkspaceRoot: false
              });
            } catch {
              // Skip invalid package.json
            }
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return packages;
}

function buildModuleMap(fileMetadata: FileMetadata[], targetDir: string): ModuleMap[] {
  const moduleGroups = new Map<string, FileMetadata[]>();

  // Group files by directory
  for (const file of fileMetadata) {
    const dir = path.dirname(file.path);
    const existing = moduleGroups.get(dir) || [];
    existing.push(file);
    moduleGroups.set(dir, existing);
  }

  const modules: ModuleMap[] = [];

  for (const [dirPath, files] of moduleGroups) {
    // Skip if too few files (likely not a meaningful module)
    if (files.length < 2 && dirPath !== ".") {
      continue;
    }

    // Aggregate keywords from all files
    const allKeywords = new Set<string>();
    files.forEach(f => f.keywords.forEach(k => allKeywords.add(k)));

    // Calculate module importance (average of file importances)
    const avgImportance = files.reduce((sum, f) => sum + f.importance, 0) / files.length;

    // Infer purpose from directory name and file types
    const purpose = inferModulePurpose(dirPath, files);

    modules.push({
      path: dirPath,
      purpose,
      keywords: Array.from(allKeywords).slice(0, 30),
      files: files.map(f => f.path),
      importance: avgImportance
    });
  }

  // Sort by importance
  return modules.sort((a, b) => b.importance - a.importance);
}

function inferModulePurpose(dirPath: string, files: FileMetadata[]): string {
  const dirName = path.basename(dirPath).toLowerCase();

  // Common directory name patterns
  const purposeMap: Record<string, string> = {
    "src": "Source code",
    "lib": "Library code",
    "components": "UI components",
    "pages": "Page components",
    "routes": "Routing logic",
    "api": "API endpoints",
    "services": "Business logic services",
    "utils": "Utility functions",
    "helpers": "Helper functions",
    "hooks": "React hooks",
    "stores": "State management",
    "models": "Data models",
    "schemas": "Data schemas",
    "types": "Type definitions",
    "config": "Configuration",
    "commands": "CLI commands",
    "controllers": "Request controllers",
    "middleware": "Middleware functions",
    "tests": "Test files",
    "docs": "Documentation"
  };

  if (purposeMap[dirName]) {
    return purposeMap[dirName];
  }

  // Infer from file types
  const hasComponents = files.some(f => f.keywords.some(k => k.toLowerCase().includes("component")));
  if (hasComponents) return "Component library";

  const hasTests = files.every(f => f.type === "test");
  if (hasTests) return "Test suite";

  const hasConfigs = files.every(f => f.type === "config");
  if (hasConfigs) return "Configuration files";

  return "Module";
}

function tryStatSync(filePath: string) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function tryReadFileSync(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function summarizeIndexForAI(index: RepositoryIndex): string {
  const lines: string[] = [];

  lines.push("# Repository Index Summary\n");

  // Stack
  if (index.detectedStack.length > 0) {
    lines.push("## Detected Stack");
    index.detectedStack.forEach(tech => {
      const version = tech.version ? ` ${tech.version}` : "";
      const confidence = tech.confidence < 1 ? ` (${Math.round(tech.confidence * 100)}% confidence)` : "";
      lines.push(`- ${tech.name}${version} [${tech.category}]${confidence}`);
    });
    lines.push("");
  }

  // Workspace packages
  if (index.workspacePackages.length > 0) {
    lines.push("## Workspace Packages");
    index.workspacePackages.forEach(pkg => {
      const desc = pkg.description ? ` - ${pkg.description}` : "";
      lines.push(`- ${pkg.name} (${pkg.relativeDir})${desc}`);
    });
    lines.push("");
  }

  // Special documentation files
  if (index.specialFiles.length > 0) {
    lines.push("## Special Documentation Files");
    index.specialFiles.forEach(file => {
      lines.push(`### ${file.path} (${file.type})`);
      lines.push("```");
      lines.push(file.content);
      lines.push("```");
      lines.push("");
    });
  }

  // Code insights from pattern matching
  if (index.codeInsights) {
    const insights = index.codeInsights;

    // Entry points
    if (insights.entryPoints.length > 0) {
      lines.push("## Entry Points");
      insights.entryPoints.slice(0, 10).forEach(ep => {
        lines.push(`- ${ep}`);
      });
      lines.push("");
    }

    // Key patterns discovered
    if (insights.patterns.length > 0) {
      lines.push("## Key Code Patterns");
      insights.patterns.forEach(pattern => {
        lines.push(`### ${pattern.description} (${pattern.matches.length} matches)`);

        // Group matches by file
        const fileGroups = new Map<string, typeof pattern.matches>();
        pattern.matches.forEach(match => {
          const existing = fileGroups.get(match.path) || [];
          existing.push(match);
          fileGroups.set(match.path, existing);
        });

        // Show top 5 files with most matches
        const sortedFiles = Array.from(fileGroups.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 5);

        sortedFiles.forEach(([filePath, matches]) => {
          lines.push(`  - ${filePath} (${matches.length} occurrences)`);
          // Show first 3 matches from this file
          matches.slice(0, 3).forEach(m => {
            const preview = m.line.trim().slice(0, 80);
            lines.push(`    L${m.lineNumber}: ${preview}${m.line.length > 80 ? "..." : ""}`);
          });
        });
        lines.push("");
      });
    }

    // Configuration patterns
    if (insights.configPatterns.length > 0) {
      lines.push("## Configuration Patterns");
      insights.configPatterns.forEach(pattern => {
        lines.push(`### ${pattern.description}`);
        const uniqueFiles = new Set(pattern.matches.map(m => m.path));
        uniqueFiles.forEach(file => {
          lines.push(`  - ${file}`);
        });
        lines.push("");
      });
    }
  }

  // Important modules
  const topModules = index.modules.slice(0, 10);
  if (topModules.length > 0) {
    lines.push("## Key Modules");
    topModules.forEach(mod => {
      const keywords = mod.keywords.slice(0, 5).join(", ");
      lines.push(`- ${mod.path}: ${mod.purpose} | Keywords: ${keywords}`);
    });
    lines.push("");
  }

  // Important files
  if (index.importantPaths.length > 0) {
    lines.push("## Important Files");
    index.importantPaths.slice(0, 15).forEach(p => {
      lines.push(`- ${p}`);
    });
    lines.push("");
  }

  lines.push(`Total indexed files: ${index.totalFiles}`);
  lines.push(`Indexed at: ${index.indexedAt}`);

  return lines.join("\n");
}

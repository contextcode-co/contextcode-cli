import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface RipgrepMatch {
  path: string;
  lineNumber: number;
  line: string;
  match: string;
}

export interface PatternSearchResult {
  pattern: string;
  description: string;
  matches: RipgrepMatch[];
}

/**
 * Search for patterns using ripgrep
 */
export async function searchPattern(
  targetDir: string,
  pattern: string,
  options: {
    glob?: string[];
    maxCount?: number;
    caseSensitive?: boolean;
  } = {}
): Promise<RipgrepMatch[]> {
  if (!existsSync(targetDir)) {
    return [];
  }

  const args: string[] = [
    "rg",
    "--json",
    "--hidden",
    "--glob=!.git/*",
    "--glob=!node_modules/*",
    "--glob=!dist/*",
    "--glob=!build/*",
    "--glob=!coverage/*",
    "--glob=!.next/*"
  ];

  if (options.glob) {
    options.glob.forEach(g => args.push(`--glob=${g}`));
  }

  if (options.maxCount) {
    args.push(`--max-count=${options.maxCount}`);
  }

  if (!options.caseSensitive) {
    args.push("-i");
  }

  args.push("--", pattern);

  try {
    const { stdout } = await execAsync(args.join(" "), {
      cwd: targetDir,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });

    const matches: RipgrepMatch[] = [];
    const lines = stdout.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          matches.push({
            path: parsed.data.path.text,
            lineNumber: parsed.data.line_number,
            line: parsed.data.lines.text.trim(),
            match: parsed.data.submatches[0]?.match.text || ""
          });
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return matches;
  } catch (error) {
    // ripgrep exits with code 1 when no matches found
    return [];
  }
}

/**
 * Discover key patterns in the codebase like Claude Code does
 */
export async function discoverKeyPatterns(targetDir: string): Promise<PatternSearchResult[]> {
  const searches: Array<{
    pattern: string;
    description: string;
    glob?: string[];
    maxCount?: number;
  }> = [
    // CLI Commands
    {
      pattern: "\\.(command|subcommand)\\s*\\(",
      description: "CLI command definitions",
      glob: ["*.ts", "*.js"],
      maxCount: 50
    },
    {
      pattern: "program\\.(command|option)",
      description: "Commander.js CLI commands",
      glob: ["*.ts", "*.js"],
      maxCount: 50
    },
    // API Routes
    {
      pattern: "\\.(get|post|put|patch|delete)\\s*\\(['\"]",
      description: "HTTP route definitions",
      glob: ["*.ts", "*.js"],
      maxCount: 100
    },
    {
      pattern: "app\\.(get|post|put|patch|delete|use)\\s*\\(",
      description: "Express.js routes",
      glob: ["*.ts", "*.js"],
      maxCount: 100
    },
    {
      pattern: "router\\.(get|post|put|patch|delete)",
      description: "Router endpoints",
      glob: ["*.ts", "*.js"],
      maxCount: 100
    },
    // React/Vue Components
    {
      pattern: "export\\s+(?:default\\s+)?(?:function|const)\\s+\\w+.*(?:React\\.FC|FunctionComponent|Component)",
      description: "React components",
      glob: ["*.tsx", "*.jsx"],
      maxCount: 100
    },
    {
      pattern: "export\\s+default\\s+defineComponent",
      description: "Vue components",
      glob: ["*.vue"],
      maxCount: 100
    },
    // Database Models
    {
      pattern: "@Entity|@Model|model\\s*\\(",
      description: "Database models/entities",
      glob: ["*.ts", "*.js"],
      maxCount: 50
    },
    {
      pattern: "Schema\\s*\\(|new\\s+Schema",
      description: "Database schemas",
      glob: ["*.ts", "*.js"],
      maxCount: 50
    },
    // Main exports
    {
      pattern: "export\\s+(?:default\\s+)?(?:class|function|const|interface|type)\\s+\\w+",
      description: "Main exports",
      glob: ["*.ts", "*.js"],
      maxCount: 200
    },
    // Configuration
    {
      pattern: "export\\s+default\\s+defineConfig",
      description: "Configuration definitions",
      glob: ["*.config.ts", "*.config.js"],
      maxCount: 30
    },
    // Tests
    {
      pattern: "(?:describe|test|it)\\s*\\(['\"]",
      description: "Test suites",
      glob: ["*.test.ts", "*.test.js", "*.spec.ts", "*.spec.js"],
      maxCount: 50
    },
    // GraphQL
    {
      pattern: "type\\s+(?:Query|Mutation|Subscription)\\s*\\{",
      description: "GraphQL schemas",
      glob: ["*.graphql", "*.gql"],
      maxCount: 30
    },
    // WordPress hooks (if PHP detected)
    {
      pattern: "add_(?:action|filter)\\s*\\(['\"]",
      description: "WordPress hooks",
      glob: ["*.php"],
      maxCount: 50
    },
    // Error handling
    {
      pattern: "class\\s+\\w+Error\\s+extends",
      description: "Custom error classes",
      glob: ["*.ts", "*.js"],
      maxCount: 30
    },
    // Middleware
    {
      pattern: "(?:export\\s+)?(?:const|function)\\s+\\w+Middleware",
      description: "Middleware functions",
      glob: ["*.ts", "*.js"],
      maxCount: 50
    }
  ];

  const results: PatternSearchResult[] = [];

  for (const search of searches) {
    const matches = await searchPattern(targetDir, search.pattern, {
      glob: search.glob,
      maxCount: search.maxCount
    });

    if (matches.length > 0) {
      results.push({
        pattern: search.pattern,
        description: search.description,
        matches
      });
    }
  }

  return results;
}

/**
 * Search for main entry points
 */
export async function findEntryPoints(targetDir: string): Promise<string[]> {
  const entryPoints: string[] = [];

  // Common entry point patterns
  const patterns = [
    "export\\s+default\\s+(?:class|function)",
    "if\\s*\\(\\s*import\\.meta\\.url\\s*===",
    "if\\s*\\(\\s*require\\.main\\s*===\\s*module",
    "function\\s+main\\s*\\(",
    "async\\s+function\\s+main\\s*\\("
  ];

  for (const pattern of patterns) {
    const matches = await searchPattern(targetDir, pattern, {
      glob: ["*.ts", "*.js"],
      maxCount: 20
    });

    matches.forEach(m => {
      if (!entryPoints.includes(m.path)) {
        entryPoints.push(m.path);
      }
    });
  }

  return entryPoints;
}

/**
 * Find important configuration files with actual content
 */
export async function findConfigurationPatterns(targetDir: string): Promise<PatternSearchResult[]> {
  const patterns = [
    {
      pattern: "DATABASE_URL|DB_HOST|DB_CONNECTION",
      description: "Database configuration",
      glob: ["*.env*", "*.config.*"],
      maxCount: 10
    },
    {
      pattern: "API_KEY|SECRET|TOKEN|AUTH",
      description: "Authentication/API configuration",
      glob: ["*.env*", "*.config.*"],
      maxCount: 10
    },
    {
      pattern: "PORT|HOST|BASE_URL",
      description: "Server configuration",
      glob: ["*.env*", "*.config.*"],
      maxCount: 10
    }
  ];

  const results: PatternSearchResult[] = [];

  for (const { pattern, description, glob, maxCount } of patterns) {
    const matches = await searchPattern(targetDir, pattern, {
      glob,
      maxCount
    });

    if (matches.length > 0) {
      results.push({
        pattern,
        description,
        matches
      });
    }
  }

  return results;
}

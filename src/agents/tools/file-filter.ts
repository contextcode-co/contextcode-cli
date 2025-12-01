import path from "node:path";

// Default patterns to ignore
export const DEFAULT_IGNORE_PATTERNS: string[] = [
  // Build outputs
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  ".vercel",
  ".netlify",

  // Dependencies
  "node_modules",
  "vendor",
  "bower_components",
  ".pnp",

  // Package managers
  ".yarn/cache",
  ".yarn/install-state.gz",

  // Version control
  ".git",
  ".svn",
  ".hg",

  // IDEs
  ".vscode",
  ".idea",
  ".DS_Store",

  // Temporary files
  "*.log",
  "*.tmp",
  ".cache",
  ".temp",

  // Test coverage
  "coverage",
  ".nyc_output",

  // Misc
  ".env.local",
  ".env.*.local",
  "*.min.js",
  "*.bundle.js"
];

const WORDPRESS_THEME_KEEP_PATTERNS = [
  "style.css",
  "functions.php",
  "index.php",
  "header.php",
  "footer.php",
  "sidebar.php",
  "single.php",
  "page.php",
  "archive.php",
  "template-*.php",
  "inc/**/*.php",
  "templates/**/*.php"
];

type FilterContext = {
  isWordPressTheme: boolean;
  hasNodeModules: boolean;
  detectedStack: string[];
};

export function shouldIgnorePath(
  relativePath: string,
  context: FilterContext,
  customIgnorePatterns: string[] = []
): boolean {
  // WordPress theme special handling
  if (context.isWordPressTheme) {
    // Keep WordPress theme files even if they'd normally be ignored
    const isThemeFile = WORDPRESS_THEME_KEEP_PATTERNS.some(pattern => {
      if (pattern.includes("**")) {
        const regex = new RegExp(pattern.replace("**", ".*").replace(/\./g, "\\.").replace(/\*/g, "[^/]*"));
        return regex.test(relativePath);
      }
      return minimatch(relativePath, pattern);
    });

    if (isThemeFile) {
      return false;
    }

    // Ignore everything else that's not a theme file
    const themeIgnore = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".cache"
    ];

    for (const pattern of themeIgnore) {
      if (relativePath.startsWith(pattern + "/") || relativePath === pattern) {
        return true;
      }
    }
  }

  // Apply default ignore patterns
  const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...customIgnorePatterns];

  for (const pattern of allIgnorePatterns) {
    if (pattern.includes("*")) {
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    } else {
      // Directory or exact match
      if (relativePath.startsWith(pattern + "/") || relativePath === pattern) {
        return true;
      }
    }
  }

  return false;
}

// Simple glob matching (basic implementation)
function minimatch(filePath: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

export function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const sourceExts = [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".go", ".rs", ".java", ".kt", ".swift",
    ".rb", ".php", ".vue", ".svelte", ".astro"
  ];
  return sourceExts.includes(ext);
}

export function isConfigFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  const configPatterns = [
    "package.json",
    "tsconfig.json",
    "tsup.config",
    "vite.config",
    "next.config",
    "webpack.config",
    "rollup.config",
    ".env",
    "docker-compose.yml",
    "dockerfile",
    "makefile",
    ".gitignore",
    ".prettierrc",
    ".eslintrc"
  ];

  return configPatterns.some(pattern => basename.includes(pattern.toLowerCase()));
}

export function isDocumentationFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".mdx" || ext === ".txt";
}

export function isTestFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return (
    lowerPath.includes(".test.") ||
    lowerPath.includes(".spec.") ||
    lowerPath.includes("__tests__") ||
    lowerPath.includes("__test__") ||
    lowerPath.includes("/tests/") ||
    lowerPath.includes("/test/")
  );
}

export function categorizeFile(filePath: string): "source" | "config" | "documentation" | "test" | "asset" {
  if (isTestFile(filePath)) return "test";
  if (isConfigFile(filePath)) return "config";
  if (isDocumentationFile(filePath)) return "documentation";
  if (isSourceFile(filePath)) return "source";
  return "asset";
}

export function calculateFileImportance(
  filePath: string,
  context: FilterContext
): number {
  let importance = 0.5; // Base importance

  // Root-level files are more important
  const depth = filePath.split(path.sep).length - 1;
  importance += Math.max(0, (5 - depth) * 0.1);

  // Entry points and configs are critical
  const basename = path.basename(filePath).toLowerCase();
  if (
    basename === "index.ts" ||
    basename === "index.js" ||
    basename === "main.ts" ||
    basename === "app.ts" ||
    basename === "package.json" ||
    basename === "tsconfig.json"
  ) {
    importance += 0.3;
  }

  // README and documentation
  if (basename === "readme.md" || basename === "claude.md") {
    importance += 0.4;
  }

  // WordPress theme specific
  if (context.isWordPressTheme) {
    if (basename === "functions.php" || basename === "style.css") {
      importance += 0.4;
    }
  }

  return Math.min(1.0, importance);
}

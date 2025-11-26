import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { SpecialFile } from "src/types/src";

const SPECIAL_FILE_PATTERNS = [
  { pattern: "CLAUDE.md", type: "claude-rules" as const },
  { pattern: ".cursorrules", type: "cursor-rules" as const },
  { pattern: ".github/copilot-instructions.md", type: "copilot-instructions" as const },
  { pattern: "README.md", type: "readme" as const },
  { pattern: "readme.md", type: "readme" as const }
];

const MAX_FILE_SIZE = 100 * 1024; // 100KB for special files

export async function findSpecialFiles(targetDir: string): Promise<SpecialFile[]> {
  const specialFiles: SpecialFile[] = [];

  // Check for direct pattern matches
  for (const { pattern, type } of SPECIAL_FILE_PATTERNS) {
    const fullPath = path.join(targetDir, pattern);
    if (existsSync(fullPath)) {
      const content = tryReadFile(fullPath);
      if (content) {
        specialFiles.push({
          path: pattern,
          type,
          content
        });
      }
    }
  }

  // Check for .cursor/rules/ directory
  const cursorRulesDir = path.join(targetDir, ".cursor", "rules");
  if (existsSync(cursorRulesDir)) {
    try {
      const files = readdirSync(cursorRulesDir);
      for (const file of files) {
        const fullPath = path.join(cursorRulesDir, file);
        const content = tryReadFile(fullPath);
        if (content) {
          specialFiles.push({
            path: `.cursor/rules/${file}`,
            type: "cursor-rules",
            content
          });
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  return specialFiles;
}

function tryReadFile(filePath: string): string | null {
  try {
    const stats = require("fs").statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return null; // Skip files that are too large
    }
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

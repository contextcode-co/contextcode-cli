import { readFileSync } from "node:fs";
import path from "node:path";

const COMMON_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "have", "has", "had", "do", "does", "did", "will", "would",
  "should", "could", "may", "might", "must", "can", "this", "that",
  "these", "those", "get", "set", "new", "return", "if", "else", "var",
  "let", "const", "function", "class", "import", "export", "from", "default"
]);

export function extractKeywordsFromFile(filePath: string, content?: string): string[] {
  const fileContent = content || tryReadFile(filePath);
  if (!fileContent) return [];

  const ext = path.extname(filePath).toLowerCase();
  const keywords = new Set<string>();

  // Extract from filename
  const filename = path.basename(filePath, ext);
  const filenameWords = splitCamelCase(filename);
  filenameWords.forEach(word => {
    if (word.length > 2 && !COMMON_WORDS.has(word.toLowerCase())) {
      keywords.add(word);
    }
  });

  // Language-specific keyword extraction
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    extractJavaScriptKeywords(fileContent, keywords);
  } else if (ext === ".py") {
    extractPythonKeywords(fileContent, keywords);
  } else if (ext === ".php") {
    extractPHPKeywords(fileContent, keywords);
  } else if ([".go", ".rs", ".java", ".kt"].includes(ext)) {
    extractGenericKeywords(fileContent, keywords);
  }

  // Limit to top keywords
  return Array.from(keywords).slice(0, 20);
}

function extractJavaScriptKeywords(content: string, keywords: Set<string>) {
  // Extract exports
  const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }

  // Extract class names
  const classRegex = /class\s+(\w+)/g;
  while ((match = classRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }

  // Extract function names
  const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*[=:]/g;
  while ((match = functionRegex.exec(content)) !== null) {
    if (match[1].length > 3 && !COMMON_WORDS.has(match[1].toLowerCase())) {
      keywords.add(match[1]);
    }
  }

  // Extract imports
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const importName = path.basename(importPath).replace(/^[@]/, "");
    if (importName && !importName.startsWith(".")) {
      keywords.add(importName);
    }
  }

  // Extract interface/type names
  const typeRegex = /(?:interface|type)\s+(\w+)/g;
  while ((match = typeRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }
}

function extractPythonKeywords(content: string, keywords: Set<string>) {
  // Extract class definitions
  const classRegex = /class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }

  // Extract function definitions
  const functionRegex = /def\s+(\w+)/g;
  while ((match = functionRegex.exec(content)) !== null) {
    if (match[1].length > 3 && !match[1].startsWith("_")) {
      keywords.add(match[1]);
    }
  }

  // Extract imports
  const importRegex = /from\s+(\w+)|import\s+(\w+)/g;
  while ((match = importRegex.exec(content)) !== null) {
    const moduleName = match[1] || match[2];
    if (moduleName && moduleName.length > 2) {
      keywords.add(moduleName);
    }
  }
}

function extractPHPKeywords(content: string, keywords: Set<string>) {
  // Extract class names
  const classRegex = /class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }

  // Extract function names
  const functionRegex = /function\s+(\w+)/g;
  while ((match = functionRegex.exec(content)) !== null) {
    if (match[1].length > 3 && !match[1].startsWith("__")) {
      keywords.add(match[1]);
    }
  }

  // Extract WordPress hooks
  const hookRegex = /add_(?:action|filter)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = hookRegex.exec(content)) !== null) {
    keywords.add(match[1]);
  }

  // Extract WordPress functions
  const wpFunctionRegex = /(wp_\w+|get_\w+|the_\w+)/g;
  while ((match = wpFunctionRegex.exec(content)) !== null) {
    if (match[1].length > 4) {
      keywords.add(match[1]);
    }
  }
}

function extractGenericKeywords(content: string, keywords: Set<string>) {
  // Extract identifiers that look like types or important names
  const identifierRegex = /\b([A-Z][a-zA-Z0-9]*)\b/g;
  let match;
  while ((match = identifierRegex.exec(content)) !== null) {
    if (match[1].length > 3 && !COMMON_WORDS.has(match[1].toLowerCase())) {
      keywords.add(match[1]);
    }
  }
}

function splitCamelCase(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function extractExports(filePath: string, content?: string): string[] {
  const fileContent = content || tryReadFile(filePath);
  if (!fileContent) return [];

  const ext = path.extname(filePath).toLowerCase();
  const exports: string[] = [];

  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(fileContent)) !== null) {
      exports.push(match[1]);
    }
  } else if (ext === ".py") {
    const classRegex = /^class\s+(\w+)/gm;
    let match;
    while ((match = classRegex.exec(fileContent)) !== null) {
      exports.push(match[1]);
    }
    const functionRegex = /^def\s+(\w+)/gm;
    while ((match = functionRegex.exec(fileContent)) !== null) {
      if (!match[1].startsWith("_")) {
        exports.push(match[1]);
      }
    }
  }

  return exports;
}

export function extractDependencies(filePath: string, content?: string): string[] {
  const fileContent = content || tryReadFile(filePath);
  if (!fileContent) return [];

  const ext = path.extname(filePath).toLowerCase();
  const deps = new Set<string>();

  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith(".")) {
        const pkgName = importPath.startsWith("@")
          ? importPath.split("/").slice(0, 2).join("/")
          : importPath.split("/")[0];
        deps.add(pkgName);
      }
    }

    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(fileContent)) !== null) {
      const requirePath = match[1];
      if (!requirePath.startsWith(".")) {
        const pkgName = requirePath.startsWith("@")
          ? requirePath.split("/").slice(0, 2).join("/")
          : requirePath.split("/")[0];
        deps.add(pkgName);
      }
    }
  } else if (ext === ".py") {
    const importRegex = /^(?:from\s+(\w+)|import\s+(\w+))/gm;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName && moduleName.length > 2) {
        deps.add(moduleName);
      }
    }
  }

  return Array.from(deps);
}

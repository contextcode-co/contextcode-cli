import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AiProvider, Message } from "src/providers/index.js";
import { buildRepositoryIndex, summarizeIndexForAI } from "./tools/indexer";

export type ContextGeneratorInput = {
  targetDir: string;
  includeTests?: boolean;
};

export type ContextGeneratorOptions = {
  maxTokens?: number;
  temperature?: number;
};

let cachedAnalyzerPrompt: string;
let cachedIndexerPrompt: string;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function loadAnalyzerPrompt(): string {
  if (cachedAnalyzerPrompt) return cachedAnalyzerPrompt;

  const candidates = [
    path.resolve(process.cwd(), "system-prompts", "analyzer-agent.txt"),
    path.resolve(process.cwd(), "packages", "agents", "src", "system-prompts", "analyzer-agent.txt"),
    path.resolve(moduleDir, "system-prompts", "analyzer-agent.txt")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, "utf8");
        if (content && typeof content === "string") {
          cachedAnalyzerPrompt = content.trim();
          return cachedAnalyzerPrompt;
        }
      } catch (error) {
        continue;
      }
    }
  }

  throw new Error("analyzer-agent.txt system prompt not found in any expected location");
}

function loadIndexerPrompt(): string {
  if (cachedIndexerPrompt) return cachedIndexerPrompt;

  const candidates = [
    path.resolve(process.cwd(), "system-prompts", "indexer-agent.txt"),
    path.resolve(process.cwd(), "packages", "agents", "src", "system-prompts", "indexer-agent.txt"),
    path.resolve(moduleDir, "system-prompts", "indexer-agent.txt")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, "utf8");
        if (content && typeof content === "string") {
          cachedIndexerPrompt = content.trim();
          return cachedIndexerPrompt;
        }
      } catch (error) {
        continue;
      }
    }
  }

  throw new Error("indexer-agent.txt system prompt not found in any expected location");
}

export function buildAnalysisMessages(indexSummary: string): Message[] {
  const system = {
    role: "system" as const,
    content: loadAnalyzerPrompt()
  };

  const user = {
    role: "user" as const,
    content: `Analyze this repository deeply to understand what it does and how it works.\n\n${indexSummary}`
  };

  return [system, user];
}

export function buildContextGeneratorMessages(
  indexSummary: string,
  analysis: string
): Message[] {
  const system = {
    role: "system" as const,
    content: loadIndexerPrompt()
  };

  const user = {
    role: "user" as const,
    content: `Based on the following analysis, generate comprehensive documentation for this repository.

# Repository Index
${indexSummary}

# Deep Analysis
${analysis}

Generate the documentation following the required format.`
  };

  return [system, user];
}

/**
 * Generate context documentation using a two-phase approach:
 * Phase 1: Deep analysis of the codebase
 * Phase 2: Documentation generation based on analysis
 */
export async function generateContextDocs(
  provider: AiProvider,
  model: string,
  input: ContextGeneratorInput,
  options: ContextGeneratorOptions = {}
): Promise<string> {
  console.log("[context-generator] Building repository index...");

  // Build comprehensive index with ripgrep pattern matching
  const indexConfig = {
    targetDir: input.targetDir,
    includeTests: input.includeTests ?? false,
    ignorePatterns: [],
    maxFiles: 10000
  };

  const repoIndex = await buildRepositoryIndex(indexConfig);
  const indexSummary = summarizeIndexForAI(repoIndex);

  console.log("[context-generator] Phase 1: Analyzing codebase...");

  // Phase 1: Deep analysis
  const analysisMessages = buildAnalysisMessages(indexSummary);
  const analysisResponse = await provider.request({
    model,
    messages: analysisMessages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.3
  });

  const analysis = analysisResponse.text ?? "";
  if (!analysis.trim()) {
    throw new Error("Analysis phase returned an empty response");
  }

  console.log("[context-generator] Phase 2: Generating documentation...");

  // Phase 2: Documentation generation with analysis context
  const docMessages = buildContextGeneratorMessages(indexSummary, analysis);
  const docResponse = await provider.request({
    model,
    messages: docMessages,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature ?? 0.2
  });

  const documentation = docResponse.text ?? "";
  if (!documentation.trim()) {
    throw new Error("Documentation generation returned an empty response");
  }

  return documentation;
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AiProvider, Message } from "@contextcode/providers";
import { detectStack } from "./tools/stack-detector.js";
import { summarizeIndexForAI } from "./tools/indexer.js";

export type ContextGeneratorInput = {
  targetDir: string;
  includeTests?: boolean;
};

export type ContextGeneratorOptions = {
  maxTokens?: number;
  temperature?: number;
};

export type ContextDocs = {
  context: string;
  features: string;
  architecture: string;
  implementationGuide: string;
};

export function buildContextGeneratorMessages(input: ContextGeneratorInput): Message[] {
  const system = {
    role: "system" as const,
    content: loadIndexerPrompt() as string
  };

  // Build repository index using tools
  const indexData = buildRepositoryIndexSync(input.targetDir);
  const indexSummary = summarizeIndexForAI(indexData);

  const user = {
    role: "user" as const,
    content: `Analyze this repository and generate comprehensive documentation.\n\n${indexSummary}\n\nReturn the documentation in markdown format with the following sections:\n\n# Context\n[High-level overview and purpose]\n\n# Features\n[Key features and capabilities]\n\n# Architecture\n[Technical architecture and structure]\n\n# Implementation Guide\n[Development commands and workflows]`
  };

  return [system, user];
}

function buildRepositoryIndexSync(targetDir: string) {
  // Synchronous wrapper for the indexer
  const detectedStack = detectStack(targetDir);

  return {
    detectedStack,
    workspacePackages: [],
    importantPaths: [],
    modules: [],
    fileMetadata: [],
    specialFiles: [],
    ignoredPatterns: [],
    totalFiles: 0,
    indexedAt: new Date().toISOString()
  };
}

let cachedPrompt: string;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function loadIndexerPrompt() {
  if (cachedPrompt) return cachedPrompt;

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
          cachedPrompt = content.trim();
          return cachedPrompt;
        }
      } catch (error) {
        continue;
      }
    }
  }

  throw new Error("indexer-agent.txt system prompt not found in any expected location");
}

export async function generateContextDocs(
  provider: AiProvider,
  model: string,
  input: ContextGeneratorInput,
  options: ContextGeneratorOptions = {}
): Promise<string> {
  const messages = buildContextGeneratorMessages(input);
  const response = await provider.request({
    model,
    messages,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature ?? 0.2
  });

  const rawText = response.text ?? "";
  if (!rawText.trim()) {
    throw new Error("Context generator returned an empty response");
  }

  return rawText;
}


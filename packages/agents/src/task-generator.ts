import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AiProvider, Message } from "@contextcode/providers";

const DOC_SNIPPET_LIMIT = 2000;
const MAX_TASKS = 6;

export type TaskGeneratorContext = {
  userPrompt: string;
  indexJson: any;
  docs: Record<string, string>;
};

export type TaskGeneratorOptions = {
  maxTokens?: number;
  temperature?: number;
};

export function buildTaskGeneratorMessages({ userPrompt, indexJson, docs }: TaskGeneratorContext): Message[] {
  const system = {
    role: "system" as const,
    content: loadPoAgentPrompt() as string
  };

  const sections: string[] = [];
  sections.push(`User request:\n${userPrompt}`);
  sections.push(`Index summary:\n${summarizeIndex(indexJson)}`);

  for (const [name, content] of Object.entries(docs)) {
    sections.push(`${name}:\n${truncate(content, DOC_SNIPPET_LIMIT)}`);
    if (sections.length >= MAX_TASKS + 2) break; // prevent oversized prompts
  }

  const user = {
    role: "user" as const,
    content: sections.join("\n\n") + "\n\nReturn only the requested markdown."
  };

  return [system, user];
}

let cachedPrompt: string;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function loadPoAgentPrompt() {
  if (cachedPrompt) return cachedPrompt;

  const candidates = [
    path.resolve(process.cwd(), "system-prompts", "po-agent.txt"),
    path.resolve(process.cwd(), "packages", "agents", "src", "system-prompts", "po-agent.txt"),
    path.resolve(moduleDir, "system-prompts", "po-agent.txt")
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
        // Skip this candidate if read fails
        continue;
      }
    }
  }

  throw new Error("po-agent.txt system prompt not found in any expected location");
}

export type TaskPlanResult = {
  raw: string;
};

export async function generateTaskPlanByAgent(
  provider: AiProvider,
  model: string,
  context: TaskGeneratorContext,
  options: TaskGeneratorOptions = {}
): Promise<TaskPlanResult> {
  const messages = buildTaskGeneratorMessages(context);
  const response = await provider.request({
    model,
    messages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.2
  });

  const rawText = response.text ?? "";
  if (!rawText.trim()) {
    throw new Error("Task generator returned an empty response");
  }

  return { raw: rawText };
}

function summarizeIndex(indexJson: any) {
  if (!indexJson) return "(no index)";
  const summary: string[] = [];
  if (Array.isArray(indexJson.detectedStack) && indexJson.detectedStack.length) {
    summary.push(`Stack: ${indexJson.detectedStack.join(", ")}`);
  }
  if (Array.isArray(indexJson.workspacePackages) && indexJson.workspacePackages.length) {
    const pkgs = indexJson.workspacePackages.slice(0, 6).map((pkg: any) => `${pkg.name} (${pkg.relativeDir})`);
    summary.push(`Packages: ${pkgs.join(", ")}`);
  }
  if (Array.isArray(indexJson.importantPaths) && indexJson.importantPaths.length) {
    summary.push(`Paths: ${indexJson.importantPaths.slice(0, 6).join(", ")}`);
  }
  return summary.join(" | ") || "(no data)";
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

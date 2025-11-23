import path from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";

export type Message = { role: "system" | "user" | "assistant"; content: string };

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export interface AiProvider {
  name: string;
  request(opts: { model: string; messages: Message[]; max_tokens?: number; temperature?: number }): Promise<{ text: string; usage?: TokenUsage }>;
}

export type ProviderFactoryOptions = {
  cwd?: string;
  config?: Record<string, unknown>;
  interactive?: boolean;
  [key: string]: unknown;
};

type ProviderFactory = (options?: ProviderFactoryOptions) => Promise<AiProvider> | AiProvider;

const providerFactories = new Map<string, ProviderFactory>();
type ProviderDescriptor = {
  name: string;
  title: string;
  description?: string;
  supportsInteractiveLogin?: boolean;
  login?: (options?: ProviderFactoryOptions) => Promise<void>;
};

const providerDescriptors = new Map<string, ProviderDescriptor>();

export function registerProviderFactory(name: string, factory: ProviderFactory, metadata?: Partial<ProviderDescriptor>) {
  const key = name.trim().toLowerCase();
  providerFactories.set(key, factory);
  const descriptor: ProviderDescriptor = {
    name: key,
    title: metadata?.title ?? metadata?.name ?? name,
    description: metadata?.description,
    supportsInteractiveLogin: metadata?.supportsInteractiveLogin ?? Boolean(metadata?.login),
    login: metadata?.login
  };
  providerDescriptors.set(key, descriptor);
}

export function listRegisteredProviders() {
  return Array.from(providerDescriptors.values());
}

export async function runProviderLogin(name: string, options: ProviderFactoryOptions = {}) {
  const key = name.trim().toLowerCase();
  const entry = providerDescriptors.get(key);
  if (!entry || !entry.login) {
    throw new Error(`Provider ${name} does not support interactive login.`);
  }
  await entry.login(options);
}

export async function loadProvider(providerName: string, options: ProviderFactoryOptions = {}): Promise<AiProvider> {
  if (!providerName?.trim()) {
    throw new Error("[ERR_PROVIDER_NAME_MISSING] Provider name is required. Pass --provider or set CONTEXTCODE_PROVIDER.");
  }

  const key = providerName.trim().toLowerCase();
  if (providerFactories.has(key)) {
    return providerFactories.get(key)!(options);
  }

  if (key === "stub") {
    return createStubProvider(options);
  }

  const moduleId = (options.modulePath as string | undefined) ?? providerName;
  const specifier = resolveModuleSpecifier(moduleId, options.cwd);

  try {
    const imported = await import(specifier);
    const factory: ProviderFactory | undefined = (imported as any).createProvider || (imported as any).default;
    if (typeof factory !== "function") {
      throw new Error(`Module ${moduleId} does not export a createProvider() factory.`);
    }
    const provider = await factory(options);
    assertAiProvider(provider, providerName);
    return provider;
  } catch (err: any) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" || /Cannot find module/.test(String(err?.message))) {
      throw new Error(`[ERR_PROVIDER_NOT_FOUND] Provider \"${providerName}\" could not be resolved. Supply --provider with a resolvable module or register it via registerProviderFactory.`);
    }
    throw err;
  }
}

export type StubProviderOptions = ProviderFactoryOptions & {
  responseText?: string;
  name?: string;
};

export function createStubProvider(options: StubProviderOptions = {}): AiProvider {
  const fallbackResponse = options.responseText?.trim();
  return {
    name: options.name || "stub",
    async request({ messages }: { model: string; messages: Message[] }) {
      if (fallbackResponse) {
        return { text: fallbackResponse };
      }

      const mode = detectScenario(messages);
      if (mode === "feature") {
        return { text: JSON.stringify(buildFeatureStub(messages)) };
      }
      return { text: JSON.stringify(buildTaskStub(messages)) };
    }
  };
}

function detectScenario(messages: Message[]): "feature" | "tasks" {
  const lastContent = messages[messages.length - 1]?.content || "";
  if (/Feature metadata/i.test(lastContent) || /overview/i.test(lastContent) && /slug/i.test(lastContent)) {
    return "feature";
  }
  return "tasks";
}

function buildFeatureStub(messages: Message[]) {
  const content = messages[messages.length - 1]?.content || "";
  const match = content.match(/- name:\s*(.+)/i);
  const name = match?.[1]?.trim() || "Sample Feature";
  const slug = slugify(name);
  return {
    slug,
    overview: `## Goal\n- Ship placeholder for ${name}\n\n## Scope\n- Demonstrate the contextcode CLI stub provider\n\n## Out-of-scope\n- Production ready planning\n\n## Constraints\n- Replace stub with a live provider before shipping`,
    domain_context: `Stubbed context derived from CLI inputs for ${name}.`,
    requirements: "- Replace stub provider with a real LLM source\n- Validate outputs before committing"
  };
}

function buildTaskStub(messages: Message[]) {
  const content = messages[messages.length - 1]?.content || "";
  const bulletLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .slice(0, 3);

  const tasks = (bulletLines.length ? bulletLines : ["- Review PRD inputs", "- Implement contextcode command", "- Verify outputs"]).map((line, idx) => {
    const sentence = line.replace(/^[-*]\s*/, "").trim() || `Task ${idx + 1}`;
    const id = slugify(sentence || `task-${idx + 1}`) || `task-${idx + 1}`;
    return {
      id,
      title: sentence.charAt(0).toUpperCase() + sentence.slice(1),
      objective: `Deliver stub output: ${sentence}`,
      steps: ["Plan implementation", "Apply changes", "Verify result"],
      files_hint: ["context-docs/tasks.json"],
      acceptance_criteria: ["Output saved", "Team reviewed"]
    };
  });

  return {
    summary: "Stub response providing placeholder tasks. Configure a real provider for accurate planning.",
    tasks
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function resolveModuleSpecifier(moduleId: string, cwd?: string) {
  if (moduleId.startsWith(".") || moduleId.startsWith("/")) {
    const abs = path.isAbsolute(moduleId) ? moduleId : path.resolve(cwd || process.cwd(), moduleId);
    return pathToFileURL(abs).href;
  }
  return moduleId;
}

function assertAiProvider(provider: AiProvider, label: string) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error(`Module for provider ${label} did not return a valid AiProvider.`);
  }
}

/**
 * Generic helper that calls provider and enforces JSON output validated by zod schema.
 * Retries once if parsing fails.
 */
export async function callProviderStrictJSON<T>({
  provider,
  model,
  messages,
  schema,
  maxRetries = 1
}: {
  provider: AiProvider;
  model: string;
  messages: Message[];
  schema: z.ZodSchema<T>;
  maxRetries?: number;
}): Promise<T> {
  let attempt = 0;
  let lastText: string | null = null;

  while (attempt <= maxRetries) {
    const resp = await provider.request({ model, messages });
    lastText = resp.text.trim();

    try {
      const parsed = JSON.parse(lastText);
      const result = schema.parse(parsed);
      return result;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) break;
      messages.push({
        role: "system",
        content:
          "Previous response was not valid JSON matching the required schema. You MUST reply with only valid JSON and nothing else. If you cannot, return an object { \"error\": \"reason\" }."
      });
    }
  }

  throw new Error(`Provider did not return valid JSON after ${maxRetries + 1} attempts. Last response: ${String(lastText).slice(0, 1000)}`);
}

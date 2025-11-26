import { z } from "zod";

export const ProviderModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
});

export const ProviderMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  defaultModel: z.string().min(1),
  models: z.array(ProviderModelSchema).min(1)
});

export type ProviderModel = z.infer<typeof ProviderModelSchema>;
export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

export const ProviderCatalog = [
  {
    id: "anthropic",
    title: "Anthropic Claude",
    description: "Claude Sonnet 4.x and 4.5 models via OAuth.",
    defaultModel: "claude-sonnet-4-5",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4 (May 14 '25)",
        description: "First Claude Sonnet 4 GA release."
      },
      {
        id: "claude-sonnet-4-0",
        label: "Claude Sonnet 4 (latest)",
        description: "Tracks the rolling Claude Sonnet 4 channel."
      },
      {
        id: "claude-sonnet-4-5-20250929",
        label: "Claude Sonnet 4.5 (Sep 29 '25)",
        description: "Pinned Claude Sonnet 4.5 release."
      },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5 (latest)",
        description: "Latest Claude Sonnet 4.5 channel (default)."
      }
    ]
  },
  {
    id: "gemini",
    title: "Google Gemini",
    description: "Gemini 2.x and 3.x Flash/Pro models via API key.",
    defaultModel: "gemini-3-pro-preview",
    models: [
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        description: "Fastest Gemini 2.0 Flash tier."
      },
      {
        id: "gemini-2.0-flash-lite",
        label: "Gemini 2.0 Flash Lite",
        description: "Lower-cost Gemini 2.0 Flash Lite tier."
      },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        description: "Latest Flash tier on 2.5 stack."
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        description: "Production Gemini 2.5 Pro release."
      },
      {
        id: "gemini-2.5-pro-preview-05-06",
        label: "Gemini 2.5 Pro Preview (2025-05-06)",
        description: "Preview build published May 6, 2025."
      },
      {
        id: "gemini-2.5-pro-preview-06-05",
        label: "Gemini 2.5 Pro Preview (2025-06-05)",
        description: "Preview build published June 5, 2025."
      },
      {
        id: "gemini-3-pro-preview",
        label: "Gemini 3 Pro Preview",
        description: "Latest Gemini 3 Pro preview (default)."
      }
    ]
  }
] as const satisfies ProviderMetadata[];

const providerIds = ProviderCatalog.map((entry) => entry.id) as [
  (typeof ProviderCatalog)[number]["id"],
  ...(typeof ProviderCatalog)[number]["id"][]
];

export const ProviderIdSchema = z.enum(providerIds);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export function getProviderMetadata(providerId: string) {
  return ProviderCatalog.find((entry) => entry.id === providerId);
}

export function isModelValidForProvider(providerId: string, modelId: string) {
  const metadata = getProviderMetadata(providerId);
  if (!metadata) return false;
  return metadata.models.some((model) => model.id === modelId);
}

type ModelResolutionReason = "match" | "default" | "fallback" | "unknown-provider";

export function normalizeModelForProvider(providerId: string, modelId?: string | null): {
  model?: string;
  reason: ModelResolutionReason;
} {
  const metadata = getProviderMetadata(providerId);
  if (!metadata) {
    return { model: modelId ?? undefined, reason: "unknown-provider" };
  }

  if (modelId && metadata.models.some((model) => model.id === modelId)) {
    return { model: modelId, reason: "match" };
  }

  return {
    model: metadata.defaultModel,
    reason: modelId ? "fallback" : "default"
  };
}

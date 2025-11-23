import { z } from "zod";
import { ProviderIdSchema, normalizeModelForProvider } from "./providers";

const BaseUserConfigSchema = z
  .object({
    defaultProvider: ProviderIdSchema.optional(),
    defaultModel: z.string().min(1).optional(),
    geminiApiKey: z.string().min(1).optional(),
    geminiModel: z.string().min(1).optional(),
    geminiEndpoint: z.string().min(1).optional(),
    geminiTemperature: z.number().optional(),
    geminiMaxOutputTokens: z.number().optional()
  })
  .passthrough();

export const UserConfigSchema = BaseUserConfigSchema.superRefine((value, ctx) => {
  if (!value.defaultProvider) {
    return;
  }

  const normalized = normalizeModelForProvider(value.defaultProvider, value.defaultModel);
  if (normalized.reason === "unknown-provider") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultProvider"],
      message: `Unknown provider "${value.defaultProvider}"`
    });
    return;
  }

  if (!value.defaultModel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultModel"],
      message: "defaultModel is required when defaultProvider is set"
    });
    return;
  }

  if (normalized.reason === "fallback") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultModel"],
      message: `Model "${value.defaultModel}" is not valid for provider "${value.defaultProvider}"`
    });
  }
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

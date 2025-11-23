import { z } from "zod";

export const GeminiConfigSchema = z.object({
  apiKey: z
    .string()
    .min(10, "Gemini API key is required")
    .regex(/^AI[a-zA-Z0-9_-]{20,}$/i, "Gemini API keys start with 'AI' and must be at least 20 characters."),
  model: z.string().min(1).default("gemini-1.5-pro"),
  endpoint: z.string().url().optional().default("https://generativelanguage.googleapis.com/v1beta"),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional()
});

export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

export type GeminiContentPart = {
  text: string;
};

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiContentPart[];
};

export type GeminiRequest = {
  contents: GeminiContent[];
  systemInstruction?: {
    role: "user" | "model";
    parts: GeminiContentPart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
};

export type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

export type GeminiCandidate = {
  finishReason?: string;
  content?: GeminiContent;
};

export type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

import type { z } from "zod";

export type Message = { role: "system" | "user" | "assistant"; content: string };

export interface AiProvider {
  name: string;
  request(opts: { model: string; messages: Message[]; max_tokens?: number; temperature?: number }): Promise<{ text: string }>;
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

    // try parse JSON
    try {
      const parsed = JSON.parse(lastText);
      const result = schema.parse(parsed);
      return result;
    } catch (err) {
      // prepare follow-up message to force JSON-only output
      attempt++;
      if (attempt > maxRetries) break;
      messages.push({
        role: "system",
        content:
          "Previous response was not valid JSON matching the required schema. You MUST reply with only valid JSON and nothing else. If you cannot, return an object { \"error\": \"reason\" }."
      });
      // loop retry
    }
  }

  throw new Error(`Provider did not return valid JSON after ${maxRetries + 1} attempts. Last response: ${String(lastText).slice(0, 1000)}`);
}

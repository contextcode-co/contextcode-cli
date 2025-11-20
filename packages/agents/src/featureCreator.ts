import { FeatureSchema, type Feature } from "@contextcode/types";
import type { AiProvider, Message } from "@contextcode/providers";
import { z } from "zod";

/**
 * Build messages for FeatureCreatorAgent.
 * Keep system strict: ONLY JSON matching FeatureSchema.
 */
export function buildFeatureCreatorMessages(indexJson: any, featureName: string, shortDesc?: string): Message[] {
  const system = {
    role: "system" as const,
    content:
      "You are a concise technical writer. Output ONLY a valid JSON object matching this schema:\n" +
      JSON.stringify({
        slug: "string",
        overview: "string",
        domain_context: "string (optional)",
        requirements: "string (bullet list, optional)"
      }) +
      "\nDo NOT include any explanation or additional keys."
  };

  const user = {
    role: "user" as const,
    content: `Project index (JSON):\n${JSON.stringify(indexJson, null, 2)}\n\nFeature metadata:\n- name: ${featureName}\n- short_description: ${shortDesc || ""}\n\nProduce JSON with fields: slug, overview, domain_context (optional), requirements (optional). Overview MUST include sections: Goal, Scope, Out-of-scope, Constraints.`
  };

  return [system, user];
}

/**
 * Call provider and validate output against FeatureSchema
 */
export async function createFeatureByAgent(opts: {
  provider: AiProvider;
  model: string;
  indexJson: any;
  featureName: string;
  shortDesc?: string;
  maxRetries?: number;
}): Promise<Feature> {
  const { provider, model, indexJson, featureName, shortDesc, maxRetries = 1 } = opts;
  const messages = buildFeatureCreatorMessages(indexJson, featureName, shortDesc);

  // dynamic import to avoid cycle at top-level
  const providersPkg = await import("@contextcode/providers");
  // use zod schema from types (ensure runtime import)
  const schema = FeatureSchema;

  const result = await providersPkg.callProviderStrictJSON({
    provider,
    model,
    messages,
    schema,
    maxRetries
  });

  // result is validated by zod in callProviderStrictJSON wrapper; cast for TS
  return result as Feature;
}

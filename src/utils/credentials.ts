import fs from "node:fs/promises";
import { getCredentialsFilePath } from "@contextcode/providers";
import { ProviderCatalog, type ProviderMetadata, type ProviderId } from "@contextcode/types";

export type CredentialProvider = Pick<ProviderMetadata, "title" | "description" | "defaultModel" | "models"> & {
  id: ProviderId;
};

export function getResolvedCredentialsPath() {
  return getCredentialsFilePath();
}

export async function loadCredentialProviders(): Promise<CredentialProvider[]> {
  const filePath = getCredentialsFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Credentials file at ${filePath} is not valid JSON: ${err?.message ?? err}`);
  }

  const entries = Array.isArray(parsed?.credentials) ? parsed.credentials : [];
  const metadataLookup = new Map(ProviderCatalog.map((entry) => [entry.id, entry] as const));
  const seen = new Set<string>();
  const providers: CredentialProvider[] = [];

  for (const entry of entries) {
    const providerId = typeof entry?.provider === "string" ? entry.provider.trim().toLowerCase() : "";
    if (!providerId || seen.has(providerId)) {
      continue;
    }
    seen.add(providerId);
    const metadata = metadataLookup.get(providerId);
    if (!metadata) {
      continue;
    }
    providers.push({
      id: metadata.id,
      title: metadata.title,
      description: metadata.description,
      defaultModel: metadata.defaultModel,
      models: metadata.models
    });
  }

  return providers;
}

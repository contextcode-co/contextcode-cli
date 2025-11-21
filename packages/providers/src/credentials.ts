import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const CREDENTIALS_DIR = path.join(os.homedir(), ".contextcode");
export const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

export type StoredCredential = {
  provider: string;
  key?: string;
  date: string;
  oauth?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
};

type CredentialFile = {
  credentials: StoredCredential[];
};

async function readCredentialFile(): Promise<CredentialFile> {
  try {
    const raw = await fs.readFile(CREDENTIALS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.credentials)) {
      return {
        credentials: parsed.credentials.filter((entry: any) =>
          typeof entry?.provider === "string" && (typeof entry?.key === "string" || entry?.oauth)
        )
      };
    }
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { credentials: [] };
    }
    console.warn(`[contextcode] Failed to read credentials file: ${error instanceof Error ? error.message : error}`);
  }
  return { credentials: [] };
}

async function writeCredentialFile(file: CredentialFile) {
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(file, null, 2), "utf8");
}

export async function loadCredential(provider: string): Promise<StoredCredential | null> {
  const file = await readCredentialFile();
  return file.credentials.find((entry) => entry.provider === provider) ?? null;
}

export async function saveCredential(provider: string, key: string) {
  const file = await readCredentialFile();
  const filtered = file.credentials.filter((entry) => entry.provider !== provider);
  const updated: CredentialFile = {
    credentials: [
      ...filtered,
      {
        provider,
        key,
        date: new Date().toISOString()
      }
    ]
  };
  await writeCredentialFile(updated);
}

export async function saveOAuthCredential(
  provider: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
) {
  const file = await readCredentialFile();
  const filtered = file.credentials.filter((entry) => entry.provider !== provider);
  const updated: CredentialFile = {
    credentials: [
      ...filtered,
      {
        provider,
        date: new Date().toISOString(),
        oauth: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt
        }
      }
    ]
  };
  await writeCredentialFile(updated);
}

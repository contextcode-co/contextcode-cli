import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { writeJsonFileAtomic } from "@contextcode/core";
import { UserConfigSchema, normalizeModelForProvider, type UserConfig } from "@contextcode/types";

export type { UserConfig };

function resolveContextcodeDir() {
  const override = process.env.CONTEXTCODE_HOME?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ".contextcode");
}

function getConfigFilePathInternal() {
  return path.join(resolveContextcodeDir(), "config.json");
}

export async function readUserConfig(): Promise<UserConfig> {
  const filePath = getConfigFilePathInternal();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return {};
    }
    throw err;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to parse config file at ${filePath}: ${err?.message ?? err}`);
  }

  const parsed = UserConfigSchema.safeParse(parsedJson);
  if (parsed.success) {
    return parsed.data;
  }

  const correction = tryAutoCorrectConfig(parsedJson);
  if (correction) {
    console.warn(`[contextcode] ${correction.message}`);
    await writeJsonFileAtomic(filePath, correction.config);
    await secureConfigPermissions(filePath);
    return correction.config;
  }

  throw parsed.error;
}

export async function writeUserConfig(config: UserConfig) {
  await persistConfig(config, (message) => console.warn(`[contextcode] ${message}`));
}

export async function updateUserConfig(patch: Partial<UserConfig>) {
  const current = await readUserConfig();
  const merged = { ...current, ...patch } satisfies UserConfig;
  return await persistConfig(merged, (message) => console.warn(`[contextcode] ${message}`));
}

export function getConfigPath() {
  return getConfigFilePathInternal();
}

async function persistConfig(config: Partial<UserConfig>, onAutoCorrect?: (message: string) => void) {
  const normalized = normalizeConfigForWrite(config, onAutoCorrect);
  const filePath = getConfigFilePathInternal();
  await writeJsonFileAtomic(filePath, normalized);
  await secureConfigPermissions(filePath);
  return normalized;
}

function normalizeConfigForWrite(config: Partial<UserConfig>, onAutoCorrect?: (message: string) => void) {
  const next: UserConfig = { ...(config as UserConfig) };

  if (!next.defaultProvider) {
    if (next.defaultModel) {
      onAutoCorrect?.("Removed default model because no default provider is configured.");
      delete next.defaultModel;
    }
    return UserConfigSchema.parse(next);
  }

  const resolution = normalizeModelForProvider(next.defaultProvider, next.defaultModel);
  if (resolution.reason !== "unknown-provider" && resolution.model) {
    if (!next.defaultModel || next.defaultModel !== resolution.model) {
      const reasonText =
        resolution.reason === "fallback"
          ? `Default model "${next.defaultModel ?? "(missing)"}" is not valid for provider "${next.defaultProvider}".`
          : `Default model missing for provider "${next.defaultProvider}".`;
      onAutoCorrect?.(`${reasonText} Reset to "${resolution.model}".`);
      next.defaultModel = resolution.model;
    }
  }

  return UserConfigSchema.parse(next);
}

function tryAutoCorrectConfig(raw: unknown): { config: UserConfig; message: string } | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  let capturedMessage: string | null = null;
  try {
    const normalized = normalizeConfigForWrite(raw as Partial<UserConfig>, (message) => {
      capturedMessage = message;
    });
    if (!capturedMessage) {
      return null;
    }
    return { config: normalized, message: capturedMessage };
  } catch {
    return null;
  }
}

async function secureConfigPermissions(filePath: string) {
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // Ignore platforms that do not support POSIX permissions.
  }
}

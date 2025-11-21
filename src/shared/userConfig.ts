import os from "node:os";
import path from "node:path";
import fs from "fs/promises";
import fsExtra from "fs-extra";

export type UserConfig = {
  defaultProvider?: string;
  defaultModel?: string;
};

const CONFIG_DIR = path.join(os.homedir(), ".contextcode");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export async function readUserConfig(): Promise<UserConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as UserConfig;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

export async function writeUserConfig(config: UserConfig) {
  await fsExtra.mkdirp(CONFIG_DIR);
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export async function updateUserConfig(patch: Partial<UserConfig>) {
  const current = await readUserConfig();
  const next = { ...current, ...patch } satisfies UserConfig;
  await writeUserConfig(next);
  return next;
}

export function getConfigPath() {
  return CONFIG_PATH;
}

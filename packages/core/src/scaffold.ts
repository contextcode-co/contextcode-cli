import fs from "fs/promises";
import path from "node:path";
import fsExtra from "fs-extra";

export type ContextScaffold = {
  contextDocsDir: string;
  agentLogDir: string;
};

export async function ensureDotContextDir(cwd: string) {
  const dir = path.join(cwd, "contextcode");
  await fsExtra.mkdirp(dir);
  return dir;
}

export async function createContextScaffold(cwd: string): Promise<ContextScaffold> {
  const contextDocsDir = path.join(cwd, "contextcode");
  const agentLogDir = path.join(contextDocsDir, ".agent-log");
  await fsExtra.mkdirp(agentLogDir);
  return { contextDocsDir, agentLogDir };
}

export async function writeJsonFileAtomic(filePath: string, payload: unknown) {
  const dir = path.dirname(filePath);
  await fsExtra.mkdirp(dir);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

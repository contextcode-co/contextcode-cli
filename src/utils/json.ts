import fs from "fs/promises";
import path from "node:path";
import fsExtra from "fs-extra";

const CONTEXT_DIR = ".context";

export type ContextScaffold = {
  contextDocsDir: string;
  agentLogDir: string;
};

export async function ensureDirectoryExists(targetPath: string) {
  const stats = await fsExtra.stat(targetPath).catch(() => null);
  if (!stats) {
    throw new Error(`Directory not found: ${targetPath}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Expected directory but found file: ${targetPath}`);
  }
}

export function resolveWorkingDirectory(base: string, override?: string) {
  if (!override) return base;
  return path.isAbsolute(override) ? override : path.resolve(base, override);
}

export async function createContextScaffold(cwd: string): Promise<ContextScaffold> {
  const contextDocsDir = path.join(cwd, CONTEXT_DIR);
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

export async function writeTextFileAtomic(filePath: string, contents: string) {
  const dir = path.dirname(filePath);
  await fsExtra.mkdirp(dir);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, filePath);
}

import fs from "fs/promises";
import path from "node:path";
import fsExtra from "fs-extra";
import {
  indexRepo,
  createContextScaffold,
  ensureDotContextDir,
  writeJsonFileAtomic,
  type ContextScaffold,
  type IndexResult
} from "@contextcode/core";

export type PersistIndexOptions = {
  skipContextDocs?: boolean;
  outPaths?: string[];
};

export type PersistIndexResult = {
  index: IndexResult;
  outputs: string[];
  contextScaffold?: ContextScaffold;
};

export async function buildIndexAndPersist(cwd: string, options: PersistIndexOptions = {}): Promise<PersistIndexResult> {
  const index = await indexRepo(cwd);
  const { outputs, contextScaffold } = await persistIndexResult(cwd, index, options);
  return { index, outputs, contextScaffold };
}

export async function persistIndexResult(cwd: string, index: IndexResult, options: PersistIndexOptions = {}) {
  const outputs: string[] = [];
  const seen = new Set<string>();
  const track = (p: string) => {
    const normalized = path.resolve(p);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      outputs.push(normalized);
    }
  };

  const dotDir = await ensureDotContextDir(cwd);
  const localIndexPath = path.join(dotDir, "index.json");
  await writeJsonFileAtomic(localIndexPath, index);
  track(localIndexPath);

  let contextScaffold: ContextScaffold | undefined;
  if (!options.skipContextDocs) {
    contextScaffold = await createContextScaffold(cwd);
    const docsIndexPath = path.join(contextScaffold.contextDocsDir, "index.json");
    await writeJsonFileAtomic(docsIndexPath, index);
    track(docsIndexPath);
  }

  for (const custom of options.outPaths ?? []) {
    const resolved = path.isAbsolute(custom) ? custom : path.join(cwd, custom);
    await writeJsonFileAtomic(resolved, index);
    track(resolved);
  }

  return { outputs, contextScaffold };
}

export async function readExistingIndex(cwd: string) {
  const indexPath = path.join(cwd, ".contextcode", "index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const index = JSON.parse(raw) as IndexResult;
    return { index, path: indexPath };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

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

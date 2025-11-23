import fs from "fs/promises";
import path from "node:path";
import fsExtra from "fs-extra";
import {
  indexRepo,
  createContextScaffold,
  ensureDotContextDir,
  writeJsonFileAtomic,
  writeTextFileAtomic,
  generateContextWithAI,
  renderContextMarkdown,
  renderFeaturesGuide,
  renderArchitectureGuide,
  renderImplementationGuide,
  type ContextScaffold,
  type IndexResult
} from "@contextcode/core";
import { loadProvider, type TokenUsage } from "@contextcode/providers";

export type PersistIndexOptions = {
  skipContextDocs?: boolean;
  outPaths?: string[];
  provider?: string;
  model?: string;
};

export type PersistIndexResult = {
  index: IndexResult;
  outputs: string[];
  contextScaffold?: ContextScaffold;
  tokenUsage?: TokenUsage;
};
export type PersistHooks = {
  onIndexingReady?: (index: IndexResult) => void;
  onDocGenerationStart?: () => void;
  onDocGenerationComplete?: (payload: { tokenUsage?: TokenUsage }) => void;
};

export async function buildIndexAndPersist(
  cwd: string,
  options: PersistIndexOptions = {},
  hooks: PersistHooks = {}
): Promise<PersistIndexResult> {
  const index = await indexRepo(cwd);
  hooks.onIndexingReady?.(index);
  const { outputs, contextScaffold, tokenUsage } = await persistIndexResult(cwd, index, options, hooks);
  return { index, outputs, contextScaffold, tokenUsage };
}

export async function persistIndexResult(
  cwd: string,
  index: IndexResult,
  options: PersistIndexOptions = {},
  hooks: PersistHooks = {}
) {
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

  const repoName = index.packageJson?.name ?? path.basename(cwd);
  let contextMarkdown: string;
  let tokenUsage: TokenUsage | undefined;

  if (options.provider) {
    try {
      console.log(`Generating context.md with AI provider: ${options.provider}...`);
      hooks.onDocGenerationStart?.();
      const provider = await loadProvider(options.provider, { cwd, interactive: false });
      const result = await generateContextWithAI(provider, index, {
        repoName,
        model: options.model
      });
      contextMarkdown = result.markdown;
      tokenUsage = result.usage;
    } catch (err: any) {
      console.warn(`AI generation failed: ${err.message}. Falling back to static template.`);
      contextMarkdown = renderContextMarkdown(index, { repoName });
    }
  } else {
    hooks.onDocGenerationStart?.();
    contextMarkdown = renderContextMarkdown(index, { repoName });
  }

  const companionDocs = [
    { filename: "context.md", contents: contextMarkdown },
    { filename: "features.md", contents: renderFeaturesGuide(index, { repoName }) },
    { filename: "architecture.md", contents: renderArchitectureGuide(index, { repoName }) },
    { filename: "implementation-guide.md", contents: renderImplementationGuide(index, { repoName }) }
  ];

  for (const doc of companionDocs) {
    const docPath = path.join(cwd, "contextcode", doc.filename);
    await writeTextFileAtomic(docPath, doc.contents);
    track(docPath);
    if (contextScaffold) {
      const scaffoldDocPath = path.join(contextScaffold.contextDocsDir, doc.filename);
      if (scaffoldDocPath !== docPath) {
        await writeTextFileAtomic(scaffoldDocPath, doc.contents);
        track(scaffoldDocPath);
      }
    }
  }

  hooks.onDocGenerationComplete?.({ tokenUsage });

  for (const custom of options.outPaths ?? []) {
    const resolved = path.isAbsolute(custom) ? custom : path.join(cwd, custom);
    await writeJsonFileAtomic(resolved, index);
    track(resolved);
  }

  return { outputs, contextScaffold, tokenUsage };
}

export async function readExistingIndex(cwd: string) {
  const indexPath = path.join(cwd, "contextcode", "index.json");
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

import path from "path";
import fs from "fs/promises";
import { indexRepo } from "@contextcode/core";
import { createFeatureByAgent } from "./featureCreator.js";
import { splitTasksByAgent } from "./taskSplitter.js";
import { renderOverviewMd, renderDomainContextMd, renderRequirementsMd, renderTaskPlanMd } from "@contextcode/core";
import type { AiProvider } from "@contextcode/providers";
import type { TaskPlan } from "@contextcode/types";
import crypto from "crypto";
import fsExtra from "fs-extra";

type GenerateFeatureHeadlessOpts = {
  cwd: string;
  provider: AiProvider;
  model: string;
  featureName: string;
  shortDesc?: string;
  seedFile?: string;
  branchName?: string;
  autoAccept?: boolean;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// small audit writer
async function writeAgentLog(cwd: string, entry: any) {
  const logDir = path.join(cwd, "context-docs", ".agent-log");
  await fsExtra.mkdirp(logDir);
  const ts = Date.now();
  await fs.writeFile(path.join(logDir, `agent-${ts}.json`), JSON.stringify(entry, null, 2), "utf8");
}

/**
 * Orchestrator: index -> feature -> tasks -> render file map
 * Returns Record<filename, content>
 */
export async function generateFeatureHeadless(opts: GenerateFeatureHeadlessOpts) {
  const { cwd, provider, model, featureName, shortDesc, seedFile } = opts;
  const index = await indexRepo(cwd);

  let seedText = "";
  if (seedFile) {
    try {
      const sf = path.isAbsolute(seedFile) ? seedFile : path.join(cwd, seedFile);
      seedText = await fs.readFile(sf, "utf8");
    } catch {
      seedText = "";
    }
  }

  // Feature creation
  const feature = await createFeatureByAgent({
    provider,
    model,
    indexJson: index,
    featureName,
    shortDesc: shortDesc || seedText,
    maxRetries: 1
  });

  // Task splitting (send minimal context)
  const stackSummary = (index.detectedStack || []).join(", ");
  const taskPlan = await splitTasksByAgent({
    provider,
    model,
    overview: feature.overview,
    requirements: feature.requirements || "",
    stackSummary,
    maxRetries: 1
  }) as TaskPlan;

  // Render files deterministically
  const slug = slugify(feature.slug || featureName);
  const files: Record<string, string> = {};
  files["00-overview.md"] = renderOverviewMd(feature as any);
  files["10-domain-context.md"] = renderDomainContextMd(feature as any);
  files["20-requirements.md"] = renderRequirementsMd(feature as any);
  files["30-task-plan.md"] = renderTaskPlanMd(taskPlan.tasks || []);

  // audit
  const promptHash = crypto.createHash("sha256").update(JSON.stringify({ featureName, indexSummary: index.detectedStack || [] })).digest("hex");
  await writeAgentLog(cwd, {
    flow: "generateFeatureHeadless",
    feature: slug,
    provider: provider.name,
    model,
    promptHash,
    timestamp: new Date().toISOString()
  });

  return files;
}

/**
 * CLI helper when debugging
 */
if (require.main === module) {
  // dynamic run for dev: `tsx src/orchestrator.ts`
  (async () => {
    const cwd = process.cwd();
    console.log("Running orchestrator dev at", cwd);
    // load a local provider stub if exists at ../../providers/localProvider.ts
    try {
      const providers = await import("@contextcode/providers");
      const provider: AiProvider = (providers as any).createStubProvider?.() || (providers as any).GeminiProvider?.init?.();
      if (!provider) {
        console.error("No provider stub found. Implement @contextcode/providers with a provider and re-run.");
        process.exit(1);
      }
      const files = await generateFeatureHeadless({
        cwd,
        provider,
        model: "test-model",
        featureName: "demo-feature",
        shortDesc: "Demo feature generated in dev mode"
      });
      console.log("Generated files:", Object.keys(files));
      for (const [k, v] of Object.entries(files)) {
        console.log("----", k);
        console.log(v.split("\n").slice(0, 40).join("\n"));
      }
    } catch (err) {
      console.error("orchestrator error:", err);
      process.exit(1);
    }
  })();
}

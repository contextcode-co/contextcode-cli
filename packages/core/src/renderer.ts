import path from "node:path";
import fs from "fs/promises";
import { Feature, Task } from "@contextcode/types";

export function renderOverviewMd(feature: Feature) {
  return feature.overview;
}

export function renderDomainContextMd(feature: Feature) {
  return feature.domain_context || "";
}

export function renderRequirementsMd(feature: Feature) {
  return feature.requirements || "";
}

export function renderTaskPlanMd(tasks: Task[]) {
  return tasks
    .map((t, i) => {
      const steps = t.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n");
      const filesHint = (t.files_hint || []).map((f) => `- ${f}`).join("\n") || "- (none)";
      const acceptance = (t.acceptance_criteria || []).map((a) => `- ${a}`).join("\n") || "- (none)";
      return `## Task ${i + 1} — ${t.title}
**ID:** ${t.id}
**Objective:** ${t.objective}

**Steps:**
${steps}

**Files hint:**
${filesHint}

**Acceptance criteria:**
${acceptance}

---
`;
    })
    .join("\n");
}

export async function writeFilesAtomically(
  cwd: string,
  featureSlug: string,
  files: Record<string, string>
) {
  const base = path.join(cwd, "context-docs", "features", featureSlug);
  await fs.mkdir(base, { recursive: true });
  const paths: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const fp = path.join(base, name);
    await fs.writeFile(fp, content, "utf8");
    paths.push(fp);
  }
  return paths;
}

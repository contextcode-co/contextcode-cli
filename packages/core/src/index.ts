export { indexRepo } from "./indexer.js";
export { renderOverviewMd, renderDomainContextMd, renderRequirementsMd, renderTaskPlanMd, writeFilesAtomically } from "./renderer.js";
export { createBranchAndCommit } from "./git.js";
export { createContextScaffold, ensureDotContextDir, writeJsonFileAtomic } from "./scaffold.js";
export type { IndexResult } from "./indexer.js";
export type { ContextScaffold } from "./scaffold.js";

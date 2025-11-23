export { indexRepo } from "./indexer.js";
export { renderContextMarkdown } from "./context/context-template.js";
export { renderFeaturesGuide, renderArchitectureGuide, renderImplementationGuide } from "./context/context-companion-docs.js";
export { generateContextWithAI } from "./context/context-ai-generator.js";
export { renderOverviewMd, renderDomainContextMd, renderRequirementsMd, renderTaskPlanMd, writeFilesAtomically } from "./renderer.js";
export { createContextScaffold, ensureDotContextDir, writeJsonFileAtomic, writeTextFileAtomic } from "./scaffold.js";
export type { IndexResult, WorkspacePackage, RepoScript } from "./indexer.js";
export type { ContextScaffold } from "./scaffold.js";

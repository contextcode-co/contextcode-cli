import { z } from "zod";
export {
  GeminiConfigSchema,
  type GeminiConfig,
  type GeminiContent,
  type GeminiContentPart,
  type GeminiRequest,
  type GeminiResponse,
  type GeminiCandidate,
  type GeminiUsageMetadata
} from "./gemini";
export {
  ProviderCatalog,
  ProviderMetadataSchema,
  ProviderModelSchema,
  ProviderIdSchema,
  type ProviderId,
  type ProviderMetadata,
  type ProviderModel,
  getProviderMetadata,
  isModelValidForProvider,
  normalizeModelForProvider
} from "./providers";
export { UserConfigSchema, type UserConfig } from "./config";
export {
  StackTechnologySchema,
  FileMetadataSchema,
  ModuleMapSchema,
  WorkspacePackageSchema,
  SpecialFileSchema,
  RepositoryIndexSchema,
  IndexerConfigSchema,
  type StackTechnology,
  type FileMetadata,
  type ModuleMap,
  type WorkspacePackage,
  type SpecialFile,
  type RepositoryIndex,
  type IndexerConfig
} from "./indexer";

export const FeatureSchema = z.object({
  slug: z.string().min(1),
  overview: z.string(),
  domain_context: z.string().optional().default(""),
  requirements: z.string().optional().default("")
});

export const PlanTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  steps: z.array(z.string()).min(1),
  files_hint: z.array(z.string()).optional().default([]),
  acceptance_criteria: z.array(z.string()).optional().default([])
});

export const TaskPlanSchema = z.object({
  tasks: z.array(PlanTaskSchema)
});

export const TaskListSchema = z.object({
  summary: z.string().min(1),
  tasks: z.array(PlanTaskSchema).min(1)
});

export type Feature = z.infer<typeof FeatureSchema>;
export type PlanTask = z.infer<typeof PlanTaskSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;
export type TaskList = z.infer<typeof TaskListSchema>;

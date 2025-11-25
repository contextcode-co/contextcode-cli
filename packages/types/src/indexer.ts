import { z } from "zod";

// Stack detection types
export const StackTechnologySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  category: z.enum(["framework", "language", "tool", "platform", "database", "runtime"]),
  confidence: z.number().min(0).max(1)
});

export type StackTechnology = z.infer<typeof StackTechnologySchema>;

// File metadata for AI context
export const FileMetadataSchema = z.object({
  path: z.string(),
  type: z.enum(["source", "config", "documentation", "test", "asset"]),
  keywords: z.array(z.string()),
  importance: z.number().min(0).max(1),
  exports: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional()
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

// Module/directory grouping
export const ModuleMapSchema = z.object({
  path: z.string(),
  purpose: z.string(),
  keywords: z.array(z.string()),
  files: z.array(z.string()),
  importance: z.number().min(0).max(1)
});

export type ModuleMap = z.infer<typeof ModuleMapSchema>;

// Workspace package info
export const WorkspacePackageSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  relativeDir: z.string(),
  description: z.string().optional(),
  isWorkspaceRoot: z.boolean().default(false)
});

export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;

// Special documentation files
export const SpecialFileSchema = z.object({
  path: z.string(),
  type: z.enum(["claude-rules", "cursor-rules", "copilot-instructions", "readme"]),
  content: z.string()
});

export type SpecialFile = z.infer<typeof SpecialFileSchema>;

// Repository index output
export const RepositoryIndexSchema = z.object({
  detectedStack: z.array(StackTechnologySchema),
  workspacePackages: z.array(WorkspacePackageSchema),
  importantPaths: z.array(z.string()),
  modules: z.array(ModuleMapSchema),
  fileMetadata: z.array(FileMetadataSchema),
  specialFiles: z.array(SpecialFileSchema),
  ignoredPatterns: z.array(z.string()),
  totalFiles: z.number(),
  indexedAt: z.string()
});

export type RepositoryIndex = z.infer<typeof RepositoryIndexSchema>;

// Indexer configuration
export const IndexerConfigSchema = z.object({
  targetDir: z.string(),
  ignorePatterns: z.array(z.string()).default([]),
  maxFiles: z.number().default(10000),
  includeTests: z.boolean().default(false),
  customStackDetectors: z.array(z.string()).optional()
});

export type IndexerConfig = z.infer<typeof IndexerConfigSchema>;

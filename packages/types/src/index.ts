import { z } from "zod";

export const FeatureSchema = z.object({
  slug: z.string().min(1),
  overview: z.string(),
  domain_context: z.string().optional().default(""),
  requirements: z.string().optional().default("")
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  steps: z.array(z.string()).min(1),
  files_hint: z.array(z.string()).optional().default([]),
  acceptance_criteria: z.array(z.string()).optional().default([])
});

export const TaskPlanSchema = z.object({
  tasks: z.array(TaskSchema)
});

export const TaskListSchema = z.object({
  summary: z.string().min(1),
  tasks: z.array(TaskSchema).min(1)
});

export type Feature = z.infer<typeof FeatureSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;
export type TaskList = z.infer<typeof TaskListSchema>;

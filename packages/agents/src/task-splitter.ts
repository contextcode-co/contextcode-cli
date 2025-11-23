import { TaskPlanSchema, type TaskPlan } from "@contextcode/types";
import type { AiProvider, Message } from "@contextcode/providers";

/**
 * Build messages for TaskSplitterAgent.
 */
export function buildTaskSplitterMessages(overview: string, requirements: string, stackSummary: string) {
  const system = {
    role: "system" as const,
    content:
      'You are a task-splitting assistant. Output ONLY valid JSON matching: { "tasks": [ { "id":"string", "title":"string", "objective":"string", "steps":["string"], "files_hint":["string"], "acceptance_criteria":["string"] } ] } . Each task must be implementable as a small PR (<=150 LOC). Use deterministic ids (slug-1, slug-2).'
  };

  const user = {
    role: "user" as const,
    content: `Overview:\n${overview}\n\nRequirements:\n${requirements}\n\nProject stack summary:\n${stackSummary}\n\nReturn ordered tasks.`
  };

  return [system, user];
}

/**
 * Call provider and validate TaskPlan
 */
export async function splitTasksByAgent(opts: {
  provider: AiProvider;
  model: string;
  overview: string;
  requirements: string;
  stackSummary: string;
  maxRetries?: number;
}): Promise<TaskPlan> {
  const { provider, model, overview, requirements, stackSummary, maxRetries = 1 } = opts;
  const messages = buildTaskSplitterMessages(overview, requirements, stackSummary);

  const providersPkg = await import("@contextcode/providers");
  const schema = TaskPlanSchema;

  const result = await providersPkg.callProviderStrictJSON({
    provider,
    model,
    messages,
    schema,
    maxRetries
  });

  return result as TaskPlan;
}

import type { AiProvider, Message } from "@contextcode/providers";
import { callProviderStrictJSON } from "@contextcode/providers";
import { TaskListSchema, type TaskList } from "@contextcode/types";

export function buildParsePrdMessages(indexJson: unknown, prdText: string): Message[] {
  const schemaHint = JSON.stringify(
    {
      summary: "string",
      tasks: [
        { id: "string", title: "string", objective: "string", steps: ["string"], files_hint: ["string"], acceptance_criteria: ["string"] }
      ]
    },
    null,
    2
  );

  const system: Message = {
    role: "system",
    content: `You are a senior delivery lead. Respond ONLY with valid JSON matching this TypeScript-like schema:\n${schemaHint}\nRules:\n- summary must explain the PRD goal in <=3 sentences.\n- Each task must be independently shippable and reference repository realities when relevant.\n- Task ids must be deterministic slugs (kebab-case).\n- Never add commentary outside JSON.`
  };

  const user: Message = {
    role: "user",
    content: `Repository index (JSON):\n${JSON.stringify(indexJson, null, 2)}\n\nProduct requirements document:\n${prdText}\n\nReturn a concise summary plus the ordered task list.`
  };

  return [system, user];
}

export async function parsePrdIntoTasks(opts: {
  provider: AiProvider;
  model: string;
  indexJson: unknown;
  prdText: string;
  maxRetries?: number;
}): Promise<TaskList> {
  const { provider, model, indexJson, prdText, maxRetries = 1 } = opts;
  const messages = buildParsePrdMessages(indexJson, prdText);

  const result = await callProviderStrictJSON({
    provider,
    model,
    messages,
    schema: TaskListSchema,
    maxRetries
  });

  return result as TaskList;
}

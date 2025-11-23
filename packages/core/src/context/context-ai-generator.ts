import type { IndexResult } from "../indexer.js";
import type { AiProvider, Message, TokenUsage } from "@contextcode/providers";

const MAX_SAMPLE_EXCERPTS = 12;
const MAX_WORKSPACE_DETAILS = 6;

export type ContextGeneratorOptions = {
  repoName?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Uses the configured AI provider to generate a comprehensive context.md
 * from the indexed repository metadata.
 */
export type ContextGenerationResult = {
  markdown: string;
  usage?: TokenUsage;
};

export async function generateContextWithAI(
  provider: AiProvider,
  index: IndexResult,
  options: ContextGeneratorOptions = {}
): Promise<ContextGenerationResult> {
  const repoName = options.repoName ?? index.packageJson?.name ?? "this repository";
  const model = options.model ?? "claude-sonnet-4-5";

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(repoName, index);

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const response = await provider.request({
    model,
    messages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.3
  });

  return {
    markdown: cleanMarkdownResponse(response.text),
    usage: response.usage
  };
}

function buildSystemPrompt(): string {
  return `You are an expert technical writer specializing in developer documentation. Your task is to analyze repository metadata and create a clear, concise context.md file.

The context.md serves as an AI-first guide that helps any coding assistant (Claude, GitHub Copilot, Cursor, etc.) quickly understand:
- Project architecture and structure
- Tech stack and frameworks
- Development workflows and commands
- Key directories and their purposes
- How to work efficiently within the codebase

Guidelines:
- Be factual and precise. Don't speculate or add information not present in the metadata.
- Keep descriptions concise but complete enough to orient any developer or AI assistant.
- Focus on actionable information: commands, file paths, architectural patterns.
- Use markdown formatting: headings, code blocks, bullet lists.
- Target 150-300 lines for the complete guide.
- Include a "Working With This Repo" section with best practices for AI assistants.`;
}

function buildUserPrompt(repoName: string, index: IndexResult): string {
  const sections: string[] = [];

  sections.push(`# Repository Analysis Request`);
  sections.push(`Generate a comprehensive context.md for **${repoName}** based on the following metadata:\n`);

  sections.push(`## Detected Technologies`);
  if (index.detectedStack.length) {
    sections.push(index.detectedStack.map((tech) => `- ${tech}`).join("\n"));
  } else {
    sections.push("- Stack not automatically detected. Analyze dependencies below.");
  }
  sections.push("");

  if (index.packageJson) {
    sections.push(`## Root Package`);
    sections.push(`Name: ${index.packageJson.name ?? "(unnamed)"}`);
    sections.push(`Version: ${index.packageJson.version ?? "0.0.0"}`);
    if (index.packageJson.description) {
      sections.push(`Description: ${index.packageJson.description}`);
    }

    const deps = Object.keys(index.packageJson.dependencies ?? {});
    const devDeps = Object.keys(index.packageJson.devDependencies ?? {});
    if (deps.length) {
      sections.push(`\nKey Dependencies: ${deps.slice(0, 12).join(", ")}`);
    }
    if (devDeps.length) {
      sections.push(`Dev Dependencies: ${devDeps.slice(0, 8).join(", ")}`);
    }

    const scripts = Object.entries(index.packageJson.scripts ?? {}).slice(0, 10);
    if (scripts.length) {
      sections.push(`\nAvailable Scripts:`);
      scripts.forEach(([name, cmd]) => {
        sections.push(`- ${name}: ${cmd}`);
      });
    }
    sections.push("");
  }

  if (index.workspacePackages.length) {
    sections.push(`## Workspace Packages (${index.workspacePackages.length} detected)`);
    index.workspacePackages.slice(0, MAX_WORKSPACE_DETAILS).forEach((pkg) => {
      sections.push(`\n### ${pkg.name} (${pkg.relativeDir})`);
      if (pkg.description) sections.push(pkg.description);

      const keyDeps = pkg.dependencies.slice(0, 6);
      if (keyDeps.length) {
        sections.push(`Dependencies: ${keyDeps.join(", ")}`);
      }

      if (pkg.scripts.length) {
        sections.push(`Scripts: ${pkg.scripts.slice(0, 3).map((script) => script.name).join(", ")}`);
      }
    });
    sections.push("");
  }

  if (index.sampleFiles.length) {
    sections.push(`## Sample Files (${index.sampleFiles.length} discovered)`);
    sections.push("Below are excerpts from key configuration and source files:\n");

    index.sampleFiles.slice(0, MAX_SAMPLE_EXCERPTS).forEach((file) => {
      sections.push(`### ${file.path}`);
      sections.push("```");
      sections.push(file.excerpt.slice(0, 600));
      sections.push("```\n");
    });
  }

  if (index.importantPaths.length) {
    sections.push(`## Key Directories`);
    sections.push(index.importantPaths.slice(0, 15).map((p) => `- ${p}`).join("\n"));
    sections.push("");
  }

  sections.push(`## Output Format`);
  sections.push(`Generate a markdown file with these sections:`);
  sections.push(`1. **# context.md** - Title and introduction`);
  sections.push(`2. **## Architecture** - Describe the monorepo/package structure`);
  sections.push(`3. **## Detected Stack** - List technologies and frameworks`);
  sections.push(`4. **## Development Commands** - Organized by workspace (root + packages)`);
  sections.push(`5. **## Key Directories** - File structure overview`);
  sections.push(`6. **## Working With This Repo** - Best practices for developers and AI assistants`);
  sections.push(`7. **## Search Tips** - How to efficiently find code and navigate the codebase`);
  sections.push("");
  sections.push(`Provide ONLY the markdown content. Do not include explanations, preambles, or commentary outside the markdown.`);

  return sections.join("\n");
}

function cleanMarkdownResponse(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```markdown") || cleaned.startsWith("```md")) {
    cleaned = cleaned.replace(/^```(?:markdown|md)\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n/, "");
    cleaned = cleaned.replace(/\n```$/, "");
  }

  return cleaned.trim();
}

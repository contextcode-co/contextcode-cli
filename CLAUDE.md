# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

contextcode is a TypeScript CLI that indexes repositories, generates architecture documentation, and produces executable task plans for LLM agents. The project uses a monorepo structure with workspace packages.

## Essential Commands

```bash
# Build the CLI bundle
pnpm build

# Type checking (no emit)
pnpm typecheck

# Run CLI in development (hot reload)
pnpm dev

# Run all tests
pnpm test

# Test the CLI commands
pnpm dev -- init
pnpm dev -- generate task --prompt "your task description"
pnpm dev -- task
pnpm dev -- auth login
pnpm dev -- set provider
```

## Testing

Run tests with `pnpm test`. Tests are located in:
- `packages/providers/src/__tests__/**/*.ts`
- `src/**/*.test.ts`

Tests use Node's native test runner via tsx.

## Architecture

### Monorepo Structure

The project is organized into workspace packages with path aliases defined in [tsconfig.base.json](tsconfig.base.json):

- **@contextcode/agents** ([packages/agents/](packages/agents/)) - Task plan generation orchestration, AI prompt building, system prompt loading
- **@contextcode/providers** ([packages/providers/](packages/providers/)) - Provider registry, authentication flows (OAuth for Anthropic, API keys for Gemini), and SDK integration
- **@contextcode/types** ([packages/types/](packages/types/)) - Shared TypeScript types and Zod schemas for validation
- **@contextcode/tui** ([packages/tui/](packages/tui/)) - Ink/React components for interactive CLI flows (task selection, provider/model pickers, auth UI)
- **src/** - CLI entrypoint, command implementations, shared utilities

### Key Architectural Patterns

**Provider System**: Providers are registered via `registerProviderFactory()` in [packages/providers/src/provider.ts](packages/providers/src/provider.ts). Each provider implements the `AiProvider` interface with a `request()` method. Authentication methods are registered separately via `registerAuthMethods()`. Current providers are Anthropic (OAuth with auto-refresh) and Gemini (API key).

**Command Flow**: CLI commands in [src/commands/](src/commands/) follow this pattern:
1. Parse arguments with flag definitions
2. Resolve provider/model from flags → env vars → user config (~/.contextcode/config.json)
3. Load provider instance via `loadProvider()`
4. Execute command-specific logic
5. Write outputs to `.context/` directory

**Task Generation**: The `generate task` command uses a system prompt ([packages/agents/src/system-prompts/po-agent.txt](packages/agents/src/system-prompts/po-agent.txt)) to produce markdown task plans. The flow:
1. Read repository index from `.context/index.json`
2. Load context docs (context.md, features.md, architecture.md, implementation-guide.md)
3. Build prompt with user request + index summary + docs
4. Call AI provider to generate task plan markdown
5. Write plan to `.context/tasks/<slug>/<slug>-plan.md`

**User Configuration**: Config and credentials are stored in `~/.contextcode/`:
- `credentials.json` - OAuth tokens (Anthropic) or API keys (Gemini), mode 0600
- `config.json` - Default provider, model, and provider-specific settings

The CLI resolves configuration in this order: CLI flags → environment variables → config file.

### Build System

The CLI is bundled with tsup ([tsup.config.ts](tsup.config.ts)):
- Entry: [src/index.ts](src/index.ts)
- Target: Node 18 ESM
- Bundles all workspace packages via `noExternal`
- Post-build: Copies [packages/agents/src/system-prompts/po-agent.txt](packages/agents/src/system-prompts/po-agent.txt) to `dist/system-prompts/`

### Important Files

- [packages/types/src/providers.ts](packages/types/src/providers.ts) - `ProviderCatalog` is the single source of truth for provider IDs, model IDs, and defaults
- [src/shared/user-config.ts](src/shared/user-config.ts) - User config read/write, auto-correction, model normalization
- [src/shared/tasks.ts](src/shared/tasks.ts) - Task discovery under `.context/tasks/`, markdown file globbing
- [src/utils/json.ts](src/utils/json.ts) - `createContextScaffold()` creates `.context/` and `.context/.agent-log/` directories
- [packages/agents/src/task-generator.ts](packages/agents/src/task-generator.ts) - Builds messages for task generation, loads system prompt

## Provider Configuration

Authentication and provider setup:
```bash
# Authenticate with a provider (interactive TUI)
contextcode auth login

# Set default provider (saves to ~/.contextcode/config.json)
contextcode set provider

# Set default model for current provider
contextcode set model
```

Environment variables (override config file):
- `CONTEXTCODE_PROVIDER` - Force provider (anthropic | gemini)
- `CONTEXTCODE_MODEL` - Force model ID
- `GEMINI_API_KEY` - Inline Gemini API key
- `GEMINI_MODEL` - Override Gemini default model
- `GEMINI_API_BASE` - Custom Gemini endpoint

## Generated Artifacts

All generated files live under `.context/` in the target repository:
- `index.json` - Repository index with detected stack, workspace packages, important paths
- `context.md`, `features.md`, `architecture.md`, `implementation-guide.md` - AI-generated docs
- `tasks/<slug>/<slug>-plan.md` - Task plan markdown from `generate task`
- `.agent-log/` - Agent execution logs with timestamps

## Development Notes

- Package manager is pinned to pnpm@10.15.1
- All packages use `workspace:*` for internal dependencies
- TypeScript config uses strict mode with project references
- The CLI dispatcher in [src/index.ts](src/index.ts) handles command routing: `init`, `generate task`, `task`, `auth login`, `set provider`, `set model`
- Commands throw `ArgError` for user-facing errors (caught and printed without stack traces)
- Interactive flows use Ink/React components from @contextcode/tui
- Model validation uses `normalizeModelForProvider()` which returns "match", "default", "fallback", or "unknown-provider"

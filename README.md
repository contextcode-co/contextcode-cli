# contextcode

contextcode is an AI-assisted CLI that indexes repositories, generates rich architecture documentation, and produces executable task plans for large language model (LLM) agents. The project is organized as a TypeScript monorepo with reusable packages for agents, provider integrations, shared types, and Ink-based TUIs.

## Prerequisites

- Node.js 18 or newer (the build targets Node 18 via `tsup`)
- pnpm 10.15.1 (pinned in `packageManager`)
- Git (recommended so the `init` command can log repository metadata)

## Quick start

```bash
pnpm install
pnpm build          # Bundles src/index.ts with tsup
pnpm dev -- --help  # Run the CLI in watch mode

contextcode auth login     # Configure Anthropic or Gemini credentials
contextcode init           # Index the current repository
contextcode generate task  # Produce a scoped task plan from the context docs
```

Generated artifacts live under `.context/` inside the target repository (for example `.context/context.md`, `features.md`, `architecture.md`, `implementation-guide.md`, and per-task folders).

## Monorepo architecture

```
contextcode/
├── src/                 # CLI entrypoint, commands, shared utilities
├── packages/
│   ├── agents/          # @contextcode/agents – AI task planner/orchestration logic
│   ├── core/            # @contextcode/core – indexing, scaffolding, persistence helpers
│   ├── providers/       # @contextcode/providers – provider registry, auth helpers, SDK glue
│   ├── types/           # @contextcode/types – shared TypeScript types, Zod schemas, enums
│   └── tui/             # @contextcode/tui – Ink/React components for interactive flows
└── .context/            # Generated docs and agent task outputs (created by `init`/`generate`)
```

| Package | Purpose | Key dependencies |
| --- | --- | --- |
| `@contextcode/agents` | Runs `generate-task` orchestration, validates AI output, and writes agent logs. | `@contextcode/core`, `@contextcode/providers`, `@contextcode/types`, `zod`, `fs-extra` |
| `@contextcode/core` | Builds repository indexes, writes context scaffolds, and exposes helper APIs like `createContextScaffold`. | `@contextcode/providers`, `@contextcode/types`, `fs-extra`, `globby` |
| `@contextcode/providers` | Declares provider registry, auth methods, and runtime helpers. | `zod` |
| `@contextcode/types` | Shared type definitions (tasks, tokens, provider metadata) plus Zod validation. | `zod` |
| `@contextcode/tui` | Ink components (`DescriptionPrompt`, provider/model pickers, auth flow UI). | `ink`, `react`, `ink-text-input`, `clipboardy` |

All workspace packages use `workspace:*` references and inherit compiler settings from `tsconfig.base.json`, which enables strict TypeScript, path aliases, and project references.

## CLI reference

### `contextcode init [path]`

Indexes a repository, captures sample files, and optionally generates context docs.

```
contextcode init [path] [options]

Options:
	-C, --cwd <path>       Resolve a different working directory
			--out <file>       Additional `index.json` destinations (repeatable)
			--no-context-docs  Skip generating context docs
	-p, --provider <id>    Provider to use for doc generation
	-m, --model <name>     Model tied to the provider (validated per provider)
	-y, --yes              Accept prompts without TTY confirmation
	-h, --help             Show command help
```

Outputs:
- Repository index plus optional extra `index.json` copies (`--out`)
- Context scaffold `.context/{context,features,architecture,implementation-guide}.md`
- Agent logs under `.context/.agent-log/`

### `contextcode generate task`

Creates a structured implementation plan that lives under `.context/tasks/<slug>/`.

```
contextcode generate task [options]

Options:
	-p, --prompt <text>    Provide the task description non-interactively
	-C, --cwd <path>       Override target repo
			--name <name>      Friendly task folder name (slugified)
			--provider <id>    Override provider for this run
			--model <name>     Override model for this run
	-y, --yes              Auto-confirm re-index prompts
  -h, --help             Show command help
```

Requires an existing `.context/index.json`. If it is missing, the CLI can invoke `init` on your behalf (TTY only).### `contextcode auth login`

Launches the Ink-based login picker. Available providers are registered inside `@contextcode/providers` and must expose a `login` handler. Successful auth writes credentials to `~/.contextcode/credentials.json` and updates defaults in `~/.contextcode/config.json`.

### `contextcode set provider`

Interactive picker that scans `~/.contextcode/credentials.json` and stores `defaultProvider` plus its canonical `defaultModel` in the config file. Fails fast if no credentials exist. Follow with `contextcode set model` to override the provider’s default model.

### `contextcode set model`

Requires a previously selected provider. Renders an Ink list of that provider’s supported models and persists the selection in user config. Both `set` commands inspect `CONTEXTCODE_PROVIDER` / `CONTEXTCODE_MODEL` environment variables when available.

### Global flags

- `--help`, `-h` – prints context-aware help for any command
- `--version`, `-V` – prints the CLI version from `package.json`
- `contextcode tasks generate task` – legacy alias for `generate task` (will be removed in a future release)

## Provider configuration

The provider matrix is defined in `docs/providers.md` and surfaced through the TUI.

| Provider | Auth method | Default model |
| --- | --- | --- |
| Anthropic Claude | OAuth (Claude Pro/MAX) | `claude-sonnet-4-5` |
| Google Gemini | API key | `gemini-3-pro-preview` |

Credentials and defaults live in `~/.contextcode/credentials.json` and `~/.contextcode/config.json`. You can override them per invocation with environment variables:

| Variable | Purpose |
| --- | --- |
| `CONTEXTCODE_PROVIDER` | Force a provider (`anthropic`, `gemini`, etc.). |
| `CONTEXTCODE_MODEL` | Force a model tied to the provider. |
| `GEMINI_API_KEY` | Inline Gemini API key (fallback if no stored credential). |
| `GEMINI_MODEL` | Override Gemini default model globally. |
| `GEMINI_API_BASE` | Point to a custom Gemini endpoint. |

## Development workflow

Root scripts defined in `package.json`:

| Command | Description |
| --- | --- |
| `pnpm build` | Bundles the CLI via `tsup --config tsup.config.ts` (outputs `dist/index.js`). |
| `pnpm typecheck` | Runs `tsc -p tsconfig.typecheck.json` with `noEmit`. |
| `pnpm dev` | Executes `src/index.ts` with `tsx`, enabling live CLI testing. |
| `pnpm test` | Executes tests via `tsx --test` across `packages/providers` and `src/**/*.test.ts`. |
| `pnpm dev:core` | Runs `packages/core/src/cli-dev.ts` directly for low-level experimentation. |

Workspace builds can be targeted with pnpm filters, for example `pnpm --filter @contextcode/agents build`. Compiler options live in `tsconfig.base.json` (strict TypeScript, Node-style module resolution, path aliases for every package). `tsconfig.typecheck.json` switches to `moduleResolution: "bundler"` to align with the runtime bundler.

### Tooling stack

- **tsup** – bundles the CLI entrypoint as ESM (`target: node18`, sourcemaps on, skips node_modules bundling)
- **tsx** – used for development entrypoints, tests, and `pnpm dev`
- **Ink + React 19** – drives interactive flows (`runProviderSelectUI`, `DescriptionPrompt`, auth login)
- **Zod** – validates provider metadata, task definitions, and cross-package types (`@contextcode/types`)
- **fs-extra / globby** – implements cross-platform indexing and file system primitives

## Project structure reference

```
src/
├── index.ts             # CLI dispatcher
├── commands/            # auth.ts, generate-task.ts, init.ts, set-model.ts, set-provider.ts
├── shared/              # indexing.ts, logs.ts, userConfig.ts
└── utils/               # args.ts, credentials.ts, git.ts, prompt.ts, select.ts

.context/                # Generated docs (context.md, features.md, architecture.md, implementation-guide.md)
.context/tasks/          # AI-generated task folders with overview, steps, and tasks.json
```

Refer to `.context/context.md`, `.context/architecture.md`, and `docs/providers.md` for deeper architectural notes or provider-specific instructions.

## Contributing and license

- See `CONTRIBUTING.md` for the full contribution workflow, code standards, and review expectations.
- Released under the Apache License 2.0; the complete text is available in `LICENSE`.

For questions, open an issue with details about your environment (Node version, provider, command invocation) and attach any relevant logs from `.context/.agent-log/`.

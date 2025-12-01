# contextcode

contextcode is an AI-assisted CLI that indexes repositories, and produces executable task plans for large language model (LLM) agents.

## Prerequisites

- Node.js 18 or newer (the build targets Node 18 via `tsup`)

## Quick start

Install with:
```bash
npm i -g contextcode-cli
```

```bash
ctx login     # Configure Anthropic or Gemini credentials
ctx init      # Index the current repository
ctx task      # Produce a scoped task plan from the context docs
```

Generated artifacts live under `.contextcode/` inside the target repository (for example `.contextcode/context.md` and per-task folders).

### CLI reference

`ctx init [path]`

Indexes a repository, captures sample files, and optionally generates context docs.

```
ctx init [path] [options]

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
- Context scaffold `.contextcode/context.md`
- Agent logs under `.contextcode/.agent-log/`

### `ctx task`

Creates a structured implementation plan that lives under `.contextcode/tasks/<slug>/`.

```
ctx task [options]

Options:
	-p, --prompt <text>    Provide the task description non-interactively
	-C, --cwd <path>       Override target repo
			--name <name>      Friendly task folder name (slugified)
			--provider <id>    Override provider for this run
			--model <name>     Override model for this run
	-y, --yes              Auto-confirm re-index prompts
  -h, --help             Show command help
```

Requires an existing `.contextcode/index.json`. If it is missing, the CLI can invoke `init` on your behalf (TTY only).

# `ctx login`

Launches the Ink-based login picker. Available providers are registered inside `@contextcode/providers` and must expose a `login` handler. Successful auth writes credentials to `~/.contextcode/credentials.json` and updates defaults in `~/.contextcode/config.json`.

# `ctx set provider`

Interactive picker that scans `~/.contextcode/credentials.json` and stores `defaultProvider` plus its canonical `defaultModel` in the config file. Fails fast if no credentials exist. Follow with `ctx set model` to override the provider’s default model.

# `ctx set model`

Requires a previously selected provider. Renders an Ink list of that provider’s supported models and persists the selection in user config. Both `set` commands inspect `CONTEXTCODE_PROVIDER` / `CONTEXTCODE_MODEL` environment variables when available.

### Global flags

- `--help`, `-h` – prints context-aware help for any command
- `--version`, `-V` – prints the CLI version from `package.json`

## Provider configuration

The provider matrix is defined in `docs/providers.md` and surfaced through the TUI.

| Provider | Auth method | Default model |
| --- | --- | --- |
| Anthropic Claude | OAuth (Claude Pro/MAX) | `claude-haiku-4-5` |
| Google Gemini | API key | `gemini-2.5-pro` |

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

.contextcode/                # Generated docs (context.md)
.contextcode/tasks/          # AI-generated task folders with overview, steps, and tasks.json
```

Refer to `.contextcode/context.md` for deeper architectural notes or provider-specific instructions.

## Contributing and license

- See `CONTRIBUTING.md` for the full contribution workflow, code standards, and review expectations.
- Released under the Apache License 2.0; the complete text is available in `LICENSE`.

For questions, open an issue with details about your environment (Node version, provider, command invocation) and attach any relevant logs from `.contextcode/.agent-log/`.

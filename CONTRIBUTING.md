# Contributing to contextcode

Thank you for helping improve contextcode. This guide explains how to prepare your environment, follow the project conventions, and submit high-quality contributions that keep the CLI reliable for AI-assisted workflows.

## Before you begin

1. **Use supported tooling**
   - Node.js 18+ (the bundler targets Node 18)
   - pnpm 10.15.1 (matches the `packageManager` field)
   - Git for version control and hook support
2. **Install dependencies**
   ```bash
   pnpm install
   ```
3. **Familiarize yourself with the monorepo layout** (see `README.md` and `.context/architecture.md`). Each workspace lives under `packages/<name>` and the CLI entry point is `src/index.ts`.

## Local development workflow

| Task | Command |
| --- | --- |
| Build the CLI bundle | `pnpm build` |
| Type-check every package | `pnpm typecheck` |
| Run the CLI with live reload | `pnpm dev -- <command>` |
| Execute the provider + CLI test suites | `pnpm test` |
| Hack on a specific package | `pnpm --filter @contextcode/<pkg> build` |
| Drive the core dev CLI directly | `pnpm dev:core` |

Additional tips:
- Use `pnpm --filter <pkg> test` if you add package-specific tests.
- Generated assets (indexes, docs, tasks) live under `.context/` inside the repo you point `contextcode init` at. Avoid committing those artifacts unless explicitly requested.
- User-level configuration stays under `~/.contextcode/` and should not be added to Git.

## Coding standards

- **TypeScript only**: keep files as ESM modules, leverage the shared `tsconfig.base.json`, and honor strict type checking. Prefer explicit types for public functions.
- **Cross-package imports**: reference workspace packages through their `@contextcode/*` aliases to preserve encapsulation.
- **Validation**: reuse Zod schemas from `@contextcode/types` (or add new ones there) instead of ad-hoc `any` parsing.
- **Filesystem**: prefer `fs-extra` helpers (atomic writes, mkdirp) that already exist in the project.
- **CLI compatibility**: every new command or flag must include help text (`--help` output) and be documented in `README.md`.
- **TUI flows**: Ink components in `@contextcode/tui` should remain React 19 compatible and check `process.stdin/stdout` for TTY availability.
- **Logging**: write long-running operation metadata via `writeAgentLog` so users can audit AI actions.
- **Docs**: when command behavior changes, update `.context/context.md`, `docs/providers.md`, and any affected task templates so generated guidance stays correct.

## Contribution workflow

1. **Create an issue** describing the bug or feature. Include CLI output, Node version, provider, and reproduction steps.
2. **Fork and branch**
   ```bash
   git checkout -b feat/<slug>
   ```
3. **Implement the change**
   - Keep commits focused and reference the issue ID when possible.
   - Add or update tests in `src/**/*.test.ts` or `packages/*/src/__tests__`.
   - Run `pnpm typecheck` and `pnpm test` until they pass.
4. **Validate manually**
   - Exercise the relevant CLI command via `pnpm dev -- <command>`.
   - Ensure generated documentation/task files look correct.
5. **Update docs** (README, provider docs, architectural notes, changelog if introduced).
6. **Open a pull request** with:
   - Summary of changes and motivation
   - Testing evidence (`pnpm typecheck`, `pnpm test`, manual CLI runs)
   - Screenshots or terminal captures for new TUIs/flows when appropriate

PRs must pass CI, remain lint/type clean, and avoid unrelated formatting churn. When reviewers leave feedback, address comments or explain your decisions clearly.

## Reporting issues or requesting features

- Search existing issues to avoid duplicates.
- Provide context: CLI command, full flag list, provider/model, Node/pnpm versions, and whether the command ran interactively.
- Attach excerpts from `.context/.agent-log/` or `.context/tasks/<slug>/tasks.json` if the problem is tied to agent output.

## Code of conduct

We expect everyone to:
- Be respectful and inclusive in all communication channels.
- Assume good intent and ask clarifying questions before drawing conclusions.
- Provide constructive review feedback focused on code quality and user impact.
- Avoid sharing sensitive credentials or private repository data in issues or PRs.

Maintainers may moderate discussions or remove contributions that violate these guidelines. Repeated violations can lead to temporary or permanent loss of contribution privileges.

Thank you for making contextcode better.

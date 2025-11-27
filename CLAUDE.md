# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

contextcode is an AI-assisted CLI that indexes repositories, generates architecture documentation, and produces executable task plans for LLM agents. It features an interactive mode similar to Claude Code, where users can execute commands using a `/` prefix in a rich terminal interface. It's built as a TypeScript monorepo managed with pnpm workspaces.

## Development Commands

### Building and Type Checking
```bash
pnpm build          # Bundles the CLI via tsup (outputs to dist/index.js)
pnpm typecheck      # Runs tsc with noEmit to check types
pnpm dev            # Run the CLI in development mode with tsx
pnpm test           # Execute tests across packages with tsx --test
```

### Running the CLI in Development
```bash
pnpm dev                            # Start interactive mode (no arguments)
pnpm dev -- init                    # Index the current repository
pnpm dev -- generate task           # Generate a task plan
pnpm dev -- auth login              # Configure provider credentials
pnpm dev -- set provider            # Select default provider
pnpm dev -- set model               # Select default model
```

## Interactive Mode

When you run `contextcode` (or `pnpm dev`) without arguments in an interactive terminal, it launches an interactive session similar to Claude Code:

### Features

- **Unified Prompt Experience**: The prompt transforms based on context - command input → description input → streaming output
- **Command Prompt with `/` prefix**: All commands use a slash prefix (e.g., `/init`, `/generate task`)
- **Real-time Autocomplete**: Type `/` to see available commands with descriptions
- **Streaming Output**: Watch task generation happen line-by-line with animated text
- **State Machine UI**: Smooth transitions between idle → description → executing → streaming states
- **Tab Completion**: Press Tab to autocomplete commands
- **Keyboard Navigation**: Use arrow keys to navigate suggestions

### Available Interactive Commands

All commands support the `/` prefix:

- `/init [options]` - Index the current repository
- `/generate task` or `/task` - Generate a task implementation plan
- `/tasks` - List and select generated tasks to copy to clipboard
- `/login` or `/auth` - Authenticate with an AI provider
- `/provider` - Set the default AI provider
- `/model` - Set the default model
- `/help [command]` - Show available commands or help for a specific command
- `/clear` - Clear the terminal screen
- `/exit` or `/quit` - Exit interactive mode

### Command Aliases

Many commands have aliases for convenience:
- `/task` → `/generate`
- `/gen` → `/generate`
- `/auth` → `/login`
- `/q` → `/exit`
- `/cls` → `/clear`

### Package-specific Development
```bash
pnpm dev:core                       # Run packages/core/src/cli-dev.ts for low-level experimentation
pnpm --filter @contextcode/agents build   # Build a specific workspace package
```

## Architecture

### Monorepo Structure

The project uses pnpm workspaces with a single consolidated `src/` directory at the root:

- **`src/`**: Main CLI entrypoint, commands, and shared utilities
- **`src/commands/`**: CLI command implementations (init, generate-task, auth, set-model, set-provider, interactive)
  - `interactive.ts`: Entry point for interactive mode
  - `interactive-handlers.ts`: Command handlers for the interactive session
- **`src/agents/`**: AI task planning and orchestration logic
  - `task-generator.ts`: Generates executable task plans using LLMs
  - `context-generator.ts`: Two-phase context documentation generation (analysis → documentation)
  - `tools/`: Indexing, stack detection, file filtering, keyword extraction, ripgrep search
- **`src/providers/`**: Provider registry, auth methods, SDK glue for Anthropic and Gemini
- **`src/types/`**: Shared TypeScript types, Zod schemas, enums
- **`src/tui/`**: Ink/React components for interactive terminal flows
  - `InteractiveSession.tsx`: **Main interactive session with state machine** (6 states: idle, description, executing, streaming, provider-selection, model-selection)
  - `components/CommandPrompt.tsx`: Command input with autocomplete and suggestions
  - `components/StreamingOutput.tsx`: **Animated streaming text display** (line-by-line animation)
  - `components/SimpleSelector.tsx`: **Clean selection UI like Claude Code** (numbers, arrows, Esc to cancel)
  - `components/DescriptionPrompt.tsx`: Task description input
  - `README.md`: Complete TUI architecture documentation
  - Other components: PromptBox, SelectInput, TaskSelector (for backward compatibility)
- **`src/shared/`**: Cross-cutting concerns (logging, user config, tasks, constants)
  - `command-registry.ts`: Command registration and execution system
- **`src/utils/`**: Argument parsing, git operations, prompts, credentials, clipboard

### Key Architectural Patterns

**State Machine UI Architecture** (`InteractiveSession.tsx`):

The interactive mode uses a state machine with 7 states:
1. **idle**: Shows UnifiedPrompt in command mode, waiting for user command
2. **description**: Transforms UnifiedPrompt to description mode for task input
3. **executing**: Brief transition state while command starts
4. **streaming**: Shows StreamingOutput with animated text appearing line-by-line
5. **provider-selection**: Shows SimpleSelector for choosing AI provider
6. **model-selection**: Shows SimpleSelector for choosing AI model
7. **task-selection**: Shows TaskSelector for browsing and copying generated tasks

State transitions:
```
idle --[/generate task]--> description --[submit]--> streaming --[complete]--> idle
idle --[/provider]------> provider-selection --[select]--> streaming --[1s]--> idle
idle --[/model]---------> model-selection --[select]--> streaming --[1s]--> idle
idle --[/tasks]---------> task-selection --[select]--> streaming --[1s]--> idle
idle --[/other command]--> executing --[start]--> streaming --[complete]--> idle
```

The same UI box transforms based on state - no multiple prompts, no app closing!

**Interactive Command System**: The CLI supports two modes:
1. **Direct CLI mode**: Traditional command-line arguments (e.g., `contextcode init`)
2. **Interactive mode**: Terminal UI with command prompt and autocomplete (e.g., `contextcode` → `/init`)

The command system uses a registry pattern (`CommandRegistry` in `command-registry.ts`):
- Commands are registered with handlers that implement `CommandHandler` interface
- Each handler defines: name, aliases, description, usage, category, and execute function
- Interactive handlers wrap existing CLI commands for seamless integration
- Supports command suggestions, tab completion, and history tracking

**Streaming Text Animation** (`StreamingOutput.tsx`):

Uses React state and `useEffect` hooks to create animated text:
- Lines appear one by one with configurable delay (50ms default)
- Characters in current line animate progressively (10ms per char)
- Cursor (`▌`) shows during animation
- Support for colored output: success (green), error (red), info (cyan), warning (yellow)
- Timestamps optional for each line

Example usage:
```typescript
<StreamingOutput
  lines={[
    { content: "Analyzing repository...", type: "info" },
    { content: "Indexed 68 files", type: "success" }
  ]}
  isComplete={false}
/>
```

**Two-Phase Context Generation**: The `context-generator.ts` uses a two-phase approach:
1. **Phase 1 - Analysis**: Deep analysis of the codebase using the `analyzer-agent.txt` system prompt
2. **Phase 2 - Documentation**: Documentation generation using the `indexer-agent.txt` system prompt, informed by the analysis

**Repository Indexing Pipeline** (`src/agents/tools/indexer.ts`):
1. Stack detection via `stack-detector.ts`
2. Workspace package discovery (supports package.json workspaces and pnpm-workspace.yaml)
3. Special file discovery (README, LICENSE, etc.)
4. File categorization and importance scoring via `file-filter.ts`
5. Keyword/export/dependency extraction via `keyword-extractor.ts`
6. Pattern discovery using ripgrep via `ripgrep-search.ts`
7. Module grouping and purpose inference

**System Prompts**: Located in `src/agents/system-prompts/`:
- `analyzer-agent.txt`: Deep analysis of codebase
- `indexer-agent.txt`: Context documentation generation
- `po-agent.txt`: Task planning (Product Owner perspective)

### Data Flow

1. **`contextcode init`**:
   - Builds repository index via `buildRepositoryIndex()`
   - Optionally generates context docs via `generateContextDocs()` (two-phase)
   - Outputs to `.context/` directory with agent logs

2. **`contextcode generate task`**:
   - Reads existing index and context docs
   - Generates task plan via `generateTaskPlanByAgent()`
   - Writes to `.context/tasks/<slug>/`

3. **Provider Resolution**:
   - Checks flags → environment variables → user config (`~/.contextcode/config.json`)
   - Credentials stored in `~/.contextcode/credentials.json`
   - Model validation via `normalizeModelForProvider()`

### Configuration Files

- **`tsconfig.base.json`**: Shared compiler settings for all packages (strict mode, ES2020, composite projects)
- **`tsconfig.json`**: Extends base, uses `moduleResolution: "bundler"` for the main build
- **`tsconfig.typecheck.json`**: Used by `pnpm typecheck` for type validation
- **`tsup.config.ts`**: Bundler configuration (targets Node 18, ESM output, sourcemaps)

### Output Artifacts

All generated files go to `.context/` in the target repository:
- `.context/context.md`: Main context documentation
- `.context/tasks/<slug>/`: Task-specific plans and overviews
- `.context/.agent-log/`: JSON logs of agent executions

## Important Implementation Details

### File Filtering and Importance Scoring

The `file-filter.ts` module implements sophisticated filtering:
- WordPress theme detection with special vendor path handling
- File importance scoring (0.0-1.0) based on path patterns
- Category assignment: source, test, config, documentation, build, asset
- Smart ignore patterns (node_modules, dist, build, .next, coverage)

### Provider System

Providers are registered in `src/providers/index.ts`:
- **Anthropic**: OAuth-based (Claude Pro/MAX), default model `claude-sonnet-4-5`
- **Gemini**: API key-based, default model `gemini-3-pro-preview`

Each provider implements a common interface with:
- `request()`: Send messages and get responses
- `login()`: Authentication flow
- Model validation

### Workspace Package Discovery

The indexer supports multiple workspace formats:
- `package.json` workspaces field (npm/yarn/pnpm)
- `pnpm-workspace.yaml` packages list
- Handles nested package.json files via globby

### TypeScript Configuration

The project uses TypeScript composite projects:
- `composite: true` in tsconfig.base.json enables project references
- Path aliases are configured for all workspace packages
- Build uses `moduleResolution: "bundler"` (tsup)
- Type checking uses `moduleResolution: "node"` (tsc)

## Testing

Tests are located in:
- `src/**/*.test.ts`
- Individual test files alongside their implementation

Run tests with `tsx --test` which uses Node's built-in test runner.

## Environment Variables

- `CONTEXTCODE_PROVIDER`: Force a provider (anthropic, gemini)
- `CONTEXTCODE_MODEL`: Force a model for the provider
- `GEMINI_API_KEY`: Inline Gemini API key (fallback)
- `GEMINI_MODEL`: Override Gemini default model
- `GEMINI_API_BASE`: Custom Gemini endpoint

## Common Patterns

### Adding a New CLI Command

1. Create a file in `src/commands/` (e.g., `my-command.ts`)
2. Export `runMyCommand(argv: string[])`
3. Define flag definitions using the `parseArgs` utility
4. Add command routing in `src/index.ts` switch statement
5. Implement help text following existing patterns

### Adding a New Interactive Command

1. Create a command handler in `src/commands/interactive-handlers.ts`:
```typescript
export const myCommandHandler: CommandHandler = {
  name: "mycommand",
  aliases: ["mc", "my"],
  description: "Description of what this command does",
  usage: "/mycommand [options]",
  category: "task", // or "config", "auth", "help"
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      // Call existing CLI command or implement logic
      await runMyCommand(args);
      return { success: true, message: "Command completed!" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};
```
2. Register it in `src/commands/interactive.ts`:
```typescript
commandRegistry.register(myCommandHandler);
```
3. The command will automatically appear in autocomplete and `/help`

### Adding a New Agent Tool

1. Create a file in `src/agents/tools/` (e.g., `my-tool.ts`)
2. Export functions that operate on repository data
3. Import and use in `indexer.ts` or `context-generator.ts`
4. Add relevant types to `src/types/indexer.ts`

### Working with System Prompts

System prompts are loaded dynamically from multiple candidate paths:
1. `process.cwd()/system-prompts/<name>.txt`
2. `process.cwd()/packages/agents/src/system-prompts/<name>.txt`
3. `moduleDir/system-prompts/<name>.txt` (bundled location)

Prompts are cached after first load for performance.

## Special Considerations

### File Size Limits

- Max file size for indexing: 500KB
- Max file size for keyword extraction: 50KB
- Files exceeding limits are skipped during indexing

### WordPress Theme Handling

The indexer detects WordPress themes and applies special filtering:
- Ignores `vendor/` and `assets/vendor/` directories
- Adjusts importance scoring for PHP template files

### Git Repository Detection

Commands check for `.git/` directory and warn if not present. Some features may be limited in non-git directories.

## Debugging Tips

- Agent execution logs are written to `.context/.agent-log/` as JSON files
- Use `pnpm dev -- <command> --help` to see detailed flag documentation
- Check `~/.contextcode/credentials.json` and `~/.contextcode/config.json` for provider configuration issues
- Set environment variables to override config for testing

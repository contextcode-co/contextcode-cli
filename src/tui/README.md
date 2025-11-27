# TUI (Terminal User Interface) Structure

This directory contains all React/Ink components for the interactive terminal UI.

## Architecture Overview

```
src/tui/
├── InteractiveSession.tsx       # ⭐ MAIN - State machine for the entire app
├── components/                  # Reusable UI components
│   ├── UnifiedPrompt.tsx       # ⭐ Unified prompt (command + description modes)
│   ├── CommandPrompt.tsx       # Command input with autocomplete (legacy)
│   ├── DescriptionPrompt.tsx   # Task description input (legacy)
│   ├── SimpleSelector.tsx      # Clean selector (like Claude Code)
│   ├── StreamingOutput.tsx     # Animated streaming text
│   └── ...
├── PromptBox.tsx               # UI primitive: bordered box with steps
├── SelectInput.tsx             # UI primitive: searchable select
├── TextInput.tsx               # UI primitive: text input
└── index.ts                    # Public API exports
```

## Main Component: InteractiveSession

The `InteractiveSession` component is the **heart** of the interactive mode. It's a state machine with 7 states:

### States

1. **`idle`** - Waiting for command input
   - Shows: `UnifiedPrompt` in **command mode**
   - User types: `/init`, `/generate task`, `/help`, etc.
   - Displays: Autocomplete, suggestions, command hints

2. **`description`** - Collecting task description
   - Shows: `UnifiedPrompt` in **description mode**
   - Triggered by: `/generate task`
   - User types: Task description text
   - **Visual transformation**: Same input box, different prompt and behavior

3. **`executing`** - Brief transition state
   - Internal state while command starts

4. **`streaming`** - Showing command output
   - Shows: `StreamingOutput`
   - Displays: Animated text line-by-line

5. **`provider-selection`** - Selecting AI provider
   - Shows: `SimpleSelector`
   - Triggered by: `/provider`

6. **`model-selection`** - Selecting AI model
   - Shows: `SimpleSelector`
   - Triggered by: `/model`

7. **`task-selection`** - Browsing and copying tasks
   - Shows: `TaskSelector`
   - Triggered by: `/tasks`
   - User selects a task with arrow keys and Enter
   - Copies selected task to clipboard

### State Transitions

```
idle ──[/generate task]──> description ──[submit]──> streaming ──[complete]──> idle
idle ──[/provider]──────> provider-selection ──[select]──> streaming ──> idle
idle ──[/model]─────────> model-selection ──[select]──> streaming ──> idle
idle ──[/tasks]─────────> task-selection ──[select]──> streaming ──> idle
idle ──[/init]──────────> executing ──> streaming ──> idle
```

## Component Hierarchy

### InteractiveSession (State Machine)
```typescript
<InteractiveSession context={...} onExit={...}>
  {state === "idle" && <UnifiedPrompt mode="command" />}
  {state === "description" && <UnifiedPrompt mode="description" />}
  {state === "streaming" && <StreamingOutput />}
  {state === "provider-selection" && <SimpleSelector />}
  {state === "model-selection" && <SimpleSelector />}
  {state === "task-selection" && <TaskSelector />}
</InteractiveSession>
```

## Key Components

### CommandPrompt
- **Purpose**: Command input with autocomplete
- **Features**:
  - `/` prefix for commands
  - Real-time suggestion filtering
  - Tab completion
  - Arrow key navigation
  - Ctrl+C to exit

### DescriptionPrompt
- **Purpose**: Multi-line task description input
- **Features**:
  - Shows provider and model
  - Text input with ink-text-input

### SimpleSelector
- **Purpose**: Clean selection UI (like Claude Code)
- **Features**:
  - Number keys (1-9) for quick selection
  - Arrow keys for navigation
  - Enter to confirm
  - Esc to cancel
  - Checkmark ✔ on current value
  - Visual indicator ❯ on selected

### StreamingOutput
- **Purpose**: Animated text output
- **Features**:
  - Lines appear one by one (50ms delay)
  - Characters animate progressively (10ms each)
  - Colored output (success, error, info, warning)
  - Cursor animation during typing

### TaskSelector
- **Purpose**: Browse and select generated tasks from `.context/tasks/`
- **Features**:
  - Lists all generated tasks with labels and paths
  - Searchable (if more than 7 tasks)
  - Arrow keys for navigation
  - Enter to select and copy task to clipboard
  - Uses `SelectInput` component for filtering
- **Usage**:
  ```typescript
  <TaskSelector
    tasks={taskList}
    onSelect={(task) => {
      copyToClipboard(task.content);
    }}
  />
  ```

## Console Capture System

Located in `src/shared/console-capture.ts`:

```typescript
const capture = new ConsoleCapture((content, type) => {
  addStreamLine(content, type); // Forward to StreamingOutput
});

capture.start();
await runCommand(); // All console.log goes to StreamingOutput!
capture.stop();
```

This allows **real command output** to be streamed to the UI with animation!

## Command Registry Integration

The InteractiveSession integrates with `src/shared/command-registry.ts`:

```typescript
// Detect special commands in handleCommand()
if (cmd === "/generate task") {
  setState("description"); // Change state, don't execute
  return;
}

if (cmd === "/provider") {
  await showProviderSelection(); // Internal state change
  return;
}

if (cmd === "/tasks") {
  await showTaskSelection(); // Show task selector
  return;
}

// Default: execute via registry
await commandRegistry.execute(command, context);
```

## UI Primitives

### PromptBox
- Bordered box with step indicators
- Used for multi-step flows

### SelectInput
- Searchable select with keyboard navigation
- Used in older components

### TextInput
- Basic text input wrapper
- Not currently used (replaced by ink-text-input)

## Standalone Flows (Legacy)

These create temporary Ink renders for specific use cases:

- `AuthLoginFlow.tsx` - OAuth/API key login
- `ModelSelectFlow.tsx` - Model selection (standalone)
- `SelectProvider.tsx` - Provider selection (standalone)

**Note**: These are used by **non-interactive commands** only. The interactive mode uses inline selection via `SimpleSelector`.

## Best Practices

### Adding a New State

1. Add to `SessionState` type:
```typescript
export type SessionState =
  | "idle"
  | "my-new-state"; // Add here
```

2. Add state detection in `handleCommand()`:
```typescript
if (cmd === "/mycommand") {
  setState("my-new-state");
  return;
}
```

3. Add UI rendering:
```typescript
{state === "my-new-state" && <MyNewComponent />}
```

### Adding a New Component

1. Create in `components/MyComponent.tsx`
2. Export in `index.ts`:
```typescript
export { MyComponent } from "./components/MyComponent.js";
```

3. Use in InteractiveSession:
```typescript
import { MyComponent } from "./components/MyComponent.js";
```

## File Organization

```
components/
├── CommandPrompt.tsx      # Command input
├── DescriptionPrompt.tsx  # Task description
├── SimpleSelector.tsx     # Selection UI
├── StreamingOutput.tsx    # Streaming text
├── SelectProvider.tsx     # Provider selection (standalone)
└── TaskSelector.tsx       # Task list selector
```

Keep components **small and focused**. Each component should handle one specific UI concern.

## Testing Locally

```bash
pnpm dev

# Test states:
> /model           # → model-selection state
> /provider        # → provider-selection state
> /generate task   # → description → streaming states
> /init            # → streaming state
```

## Architecture Decisions

### Why State Machine?

The state machine pattern ensures:
- **No UI conflicts**: Only one state active at a time
- **Clean transitions**: Predictable state flow
- **No unmount/remount**: Single Ink render throughout
- **Easy to reason about**: Clear state diagram

### Why Inline Selection?

Previously, `/model` and `/provider` opened new Ink renders that closed the app. Now:
- ✅ Everything happens in the same session
- ✅ User stays in the interactive mode
- ✅ Smooth transitions between states
- ✅ Matches Claude Code UX

### Why Console Capture?

Allows us to reuse existing CLI commands (like `runGenerateTaskCommand`) without rewriting them:
- ✅ Capture console.log output
- ✅ Forward to StreamingOutput
- ✅ Get animated streaming for free
- ✅ DRY - don't duplicate command logic

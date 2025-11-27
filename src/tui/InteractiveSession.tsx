import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { UnifiedPrompt } from "./components/UnifiedPrompt.js";
import { StreamingOutput, type StreamingLine } from "./components/StreamingOutput.js";
import { SimpleSelector } from "./components/SimpleSelector.js";
import { TaskSelector, type TaskListItem } from "./components/TaskSelector.js";
import type { CommandContext } from "../shared/command-registry.js";
import { commandRegistry } from "../shared/command-registry.js";

export type SessionState =
  | "idle" // Waiting for command input
  | "description" // Collecting task description
  | "executing" // Running command
  | "streaming" // Streaming output
  | "provider-selection" // Selecting provider
  | "model-selection" // Selecting model
  | "task-selection"; // Selecting task to copy

export type InteractiveSessionProps = {
  context: CommandContext;
  onExit: () => void;
  onCommandComplete?: (command: string, success: boolean) => void;
};

type SelectionOption = {
  label: string;
  value: string;
  description?: string;
};

type SelectionData = {
  title: string;
  currentValue: string | null;
  options: SelectionOption[];
  onSelect: (value: string) => void;
};

export function InteractiveSession({
  context,
  onExit,
  onCommandComplete
}: InteractiveSessionProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [currentCommand, setCurrentCommand] = useState<string>("");
  const [streamingLines, setStreamingLines] = useState<StreamingLine[]>([]);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [shouldExit, setShouldExit] = useState(false);
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null);
  const [taskList, setTaskList] = useState<TaskListItem[]>([]);

  useEffect(() => {
    if (shouldExit) {
      onExit();
    }
  }, [shouldExit, onExit]);

  // Add a streaming line
  const addStreamLine = (content: string, type?: StreamingLine["type"]) => {
    setStreamingLines((prev) => [
      ...prev,
      {
        content,
        type,
        timestamp: new Date()
      }
    ]);
  };

  // Handle command submission from prompt
  async function handleCommand(command: string) {
    setCurrentCommand(command);

    const cmd = command.trim().toLowerCase();

    // Check if this command needs description input
    const needsDescription =
      cmd === "/generate task" ||
      cmd === "/task" ||
      cmd === "/gen" ||
      cmd === "/generate";

    if (needsDescription) {
      setState("description");
      return;
    }

    // Check if this is a provider selection command
    const isProviderCommand =
      cmd === "/provider" ||
      cmd === "/set-provider";

    if (isProviderCommand) {
      await showProviderSelection();
      return;
    }

    // Check if this is a model selection command
    const isModelCommand =
      cmd === "/model" ||
      cmd === "/set-model";

    if (isModelCommand) {
      await showModelSelection();
      return;
    }

    // Check if this is a task selection command
    const isTaskCommand = cmd === "/tasks" || cmd === "/task";

    if (isTaskCommand) {
      await showTaskSelection();
      return;
    }

    // Execute command directly
    setState("executing");
    await executeCommand(command);
  }

  // Handle description submission
  async function handleDescriptionSubmit(description: string) {
    setState("streaming");
    setStreamingLines([]);
    setIsStreamComplete(false);

    // Start streaming output
    addStreamLine("Analyzing repository...", "info");

    // Execute the task generation with the description
    await executeTaskGeneration(description);
  }

  // Execute a command
  async function executeCommand(command: string) {
    setState("streaming");
    setStreamingLines([]);
    setIsStreamComplete(false);

    try {
      // Import console capture utility
      const { ConsoleCapture } = await import("../shared/console-capture.js");

      // Set up console capture to stream output
      const capture = new ConsoleCapture((content, type) => {
        addStreamLine(content, type);
      });

      capture.start();

      let result;
      try {
        result = await commandRegistry.execute(command, context);
      } finally {
        capture.stop();
      }

      if (result.shouldExit) {
        setShouldExit(true);
        return;
      }

      if (result.message) {
        addStreamLine(
          result.message,
          result.success ? "success" : "error"
        );
      }

      setIsStreamComplete(true);

      if (onCommandComplete) {
        onCommandComplete(command, result.success);
      }

      // Return to idle after a brief delay
      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    } catch (error: any) {
      addStreamLine(error.message, "error");
      setIsStreamComplete(true);

      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    }
  }

  // Show provider selection
  async function showProviderSelection() {
    try {
      const { runSetProviderCommand } = await import("../commands/set-provider.js");
      const { loadCredentialProviders } = await import("../utils/credentials.js");
      const { readUserConfig } = await import("../shared/user-config.js");

      // Load providers first to check if there are any
      const providers = await loadCredentialProviders();
      if (!providers.length) {
        addStreamLine("No providers found. Run /login first.", "error");
        setState("idle");
        return;
      }

      const userConfig = await readUserConfig();

      // Set up selection data for SimpleSelector
      setSelectionData({
        title: "Select Provider",
        currentValue: userConfig.defaultProvider || null,
        options: providers.map((p) => ({
          label: p.title,
          value: p.id,
          description: p.description
        })),
        onSelect: async (providerId: string) => {
          // Run the actual command with custom selection function
          await runSetProviderCommand([], {
            interactive: true,
            loadProviders: async () => providers,
            selectProvider: async () => providerId,
            persistSelection: async (pid, defaultModel) => {
              const { updateUserConfig } = await import("../shared/user-config.js");
              await updateUserConfig({
                defaultProvider: pid,
                defaultModel
              });
            }
          });

          // Reload user config to update display
          const { readUserConfig } = await import("../shared/user-config.js");
          context.userConfig = await readUserConfig();

          // Return to idle immediately without streaming
          setState("idle");
        }
      });

      setState("provider-selection");
    } catch (error: any) {
      addStreamLine(error.message, "error");
      setState("idle");
    }
  }

  // Show model selection
  async function showModelSelection() {
    try {
      const { readUserConfig, updateUserConfig } = await import("../shared/user-config.js");
      const { getProviderMetadata, normalizeModelForProvider } = await import("../types/providers.js");

      const userConfig = await readUserConfig();
      const providerId = userConfig.defaultProvider;

      if (!providerId) {
        addStreamLine("No provider configured. Run /provider first.", "error");
        setState("idle");
        return;
      }

      const metadata = getProviderMetadata(providerId);
      if (!metadata) {
        addStreamLine(`Unknown provider: ${providerId}`, "error");
        setState("idle");
        return;
      }

      const normalized = normalizeModelForProvider(providerId, userConfig.defaultModel);

      // Set up selection data for SimpleSelector
      setSelectionData({
        title: "Select Model",
        currentValue: normalized.model || null,
        options: metadata.models.map((m) => ({
          label: m.label,
          value: m.id,
          description: m.description
        })),
        onSelect: async (modelId: string) => {
          // Update config using the same logic as set-model.ts
          await updateUserConfig({
            defaultProvider: providerId,
            defaultModel: modelId
          });

          // Reload user config to update display
          context.userConfig = await readUserConfig();

          // Return to idle immediately without streaming
          setState("idle");
        }
      });

      setState("model-selection");
    } catch (error: any) {
      addStreamLine(error.message, "error");
      setState("idle");
    }
  }

  // Show task selection
  async function showTaskSelection() {
    try {
      const { getTasks } = await import("../shared/tasks.js");

      const tasks = await getTasks(context.cwd);

      if (!tasks.length) {
        setState("streaming");
        setStreamingLines([]);
        setIsStreamComplete(false);
        addStreamLine("No tasks found. Run /generate task first.", "error");
        setIsStreamComplete(true);

        setTimeout(() => {
          setState("idle");
          setStreamingLines([]);
        }, 1500);
        return;
      }

      // Convert tasks to TaskListItem format
      const taskItems: TaskListItem[] = tasks.map((task) => ({
        label: task.label,
        description: task.relativePath,
        content: task.content,
        relativePath: task.relativePath
      }));

      setTaskList(taskItems);
      setState("task-selection");
    } catch (error: any) {
      setState("streaming");
      setStreamingLines([]);
      setIsStreamComplete(false);
      addStreamLine(error.message, "error");
      setIsStreamComplete(true);

      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    }
  }

  // Handle task selection
  async function handleTaskSelect(task: TaskListItem) {
    try {
      const { copyToClipboard } = await import("../utils/clipboard.js");

      setState("streaming");
      setStreamingLines([]);
      setIsStreamComplete(false);

      await copyToClipboard(task.content);

      addStreamLine(`✓ Copied ${task.label} to clipboard`, "success");
      addStreamLine(`  Path: ${task.relativePath}`, "info");
      setIsStreamComplete(true);

      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    } catch (error: any) {
      addStreamLine(error.message, "error");
      setIsStreamComplete(true);

      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    }
  }

  // Execute task generation with streaming
  async function executeTaskGeneration(description: string) {
    try {
      // Import console capture utility
      const { ConsoleCapture } = await import("../shared/console-capture.js");

      // Set up console capture to stream output
      const capture = new ConsoleCapture((content, type) => {
        addStreamLine(content, type);
      });

      capture.start();

      try {
        // Execute REAL task generation command
        const { runGenerateTaskCommand } = await import("../commands/generate-task.js");

        // Build arguments with the description
        const args = ["-p", description];

        // Execute the real command!
        await runGenerateTaskCommand(args);

        addStreamLine("Task generated successfully!", "success");
      } finally {
        capture.stop();
      }

      setIsStreamComplete(true);

      // Return to idle
      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    } catch (error: any) {
      addStreamLine(error.message, "error");
      setIsStreamComplete(true);

      setTimeout(() => {
        setState("idle");
        setStreamingLines([]);
      }, 1500);
    }
  }

  const suggestions = commandRegistry.getSuggestions();

  return (
    <Box flexDirection="column">
      {/* Welcome banner - only show in idle state */}
      {state === "idle" && (
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={2}
          paddingY={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Text bold color="white">
           ContextCode
          </Text>
          <Text dimColor>
            AI-powered repository analysis and task generation
          </Text>
          <Box marginTop={1}>
            <Text dimColor>
              Quick start: <Text color="green">/init</Text> to index your
              repository, then <Text color="green">/generate task</Text> to
              create a plan
            </Text>
          </Box>
        </Box>
      )}

      {/* State: IDLE - Show command prompt */}
      {state === "idle" && (
        <UnifiedPrompt
          mode="command"
          suggestions={suggestions}
          onSubmit={handleCommand}
          onExit={() => setShouldExit(true)}
          provider={context.userConfig.defaultProvider || "not set"}
          model={context.userConfig.defaultModel || "not set"}
        />
      )}

      {/* State: DESCRIPTION - Show description prompt (SAME BOX TRANSFORMED) */}
      {state === "description" && (
        <UnifiedPrompt
          mode="description"
          onSubmit={handleDescriptionSubmit}
          onExit={() => setState("idle")}
          provider={context.userConfig.defaultProvider || "not set"}
          model={context.userConfig.defaultModel || "not set"}
        />
      )}

      {/* State: EXECUTING or STREAMING - Show streaming output */}
      {(state === "executing" || state === "streaming") && (
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          paddingY={1}
          flexDirection="column"
        >
          <Box marginBottom={1}>
            <Text color="green" bold>
              {"> "}
            </Text>
            <Text dimColor>{currentCommand}</Text>
          </Box>
          <StreamingOutput
            lines={streamingLines}
            isComplete={isStreamComplete}
          />
        </Box>
      )}

      {/* State: PROVIDER SELECTION - Show provider selector */}
      {state === "provider-selection" && selectionData && (
        <SimpleSelector
          title="Select provider"
          subtitle="Choose your AI provider for task generation"
          options={selectionData.options}
          currentValue={selectionData.currentValue}
          onSelect={(value) => {
            if (selectionData.onSelect) {
              selectionData.onSelect(value);
            }
          }}
          onCancel={() => setState("idle")}
        />
      )}

      {/* State: MODEL SELECTION - Show model selector */}
      {state === "model-selection" && selectionData && (
        <SimpleSelector
          title="Select model"
          subtitle="Switch between Claude models. Applies to this session and future sessions."
          options={selectionData.options}
          currentValue={selectionData.currentValue}
          onSelect={(value) => {
            if (selectionData.onSelect) {
              selectionData.onSelect(value);
            }
          }}
          onCancel={() => setState("idle")}
        />
      )}

      {/* State: TASK SELECTION - Show task selector */}
      {state === "task-selection" && (
        <TaskSelector
          tasks={taskList}
          onSelect={handleTaskSelect}
        />
      )}

      {/* Footer hints - only for non-selection states */}
      {state !== "provider-selection" && state !== "model-selection" && state !== "task-selection" && (
        <Box marginTop={1}>
          <Text dimColor>
            {state === "idle" && "Quick commands: "}
            {state === "idle" && (
              <>
                <Text color="cyan">/init</Text>
                <Text dimColor> • </Text>
                <Text color="cyan">/generate task</Text>
                <Text dimColor> • </Text>
                <Text color="cyan">/help</Text>
                <Text dimColor> • </Text>
                <Text color="cyan">/exit</Text>
              </>
            )}
            {state === "description" && "Describe what you want to implement"}
            {(state === "executing" || state === "streaming") &&
              "Executing command..."}
          </Text>
        </Box>
      )}
    </Box>
  );
}

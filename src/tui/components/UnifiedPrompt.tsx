import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type CommandSuggestion = {
  command: string;
  description: string;
  usage?: string;
};

export type PromptMode = "command" | "description";

export type UnifiedPromptProps = {
  mode: PromptMode;
  suggestions?: CommandSuggestion[];
  onSubmit: (value: string) => void;
  onExit?: () => void;
  placeholder?: string;
  label?: string;
  provider?: string;
  model?: string;
};

export function UnifiedPrompt({
  mode,
  suggestions = [],
  onSubmit,
  onExit,
  placeholder,
  label,
  provider,
  model
}: UnifiedPromptProps) {
  const [input, setInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Default placeholders based on mode
  const defaultPlaceholder =
    mode === "command"
      ? "Type a command or /help for available commands"
      : "I want to implement...";

  const effectivePlaceholder = placeholder || defaultPlaceholder;
  const effectiveLabel =
    label || (mode === "description" ? "Describe what you want to implement" : "");

  // Filter suggestions based on input (only in command mode)
  const filteredSuggestions =
    mode === "command" && input.startsWith("/")
      ? suggestions.filter((s) =>
          s.command.toLowerCase().startsWith(input.toLowerCase())
        )
      : [];

  const showSuggestions = filteredSuggestions.length > 0 && input.length > 0;

  useInput((inputChar, key) => {
    // Exit on Ctrl+C or Ctrl+D
    if (key.ctrl && (inputChar === "c" || inputChar === "d")) {
      if (onExit) {
        onExit();
      }
      return;
    }

    // Handle return/enter
    if (key.return) {
      if (mode === "command" && showSuggestions && filteredSuggestions[selectedIndex]) {
        // Auto-complete with selected suggestion
        const selected = filteredSuggestions[selectedIndex];
        setInput(selected.command);
        onSubmit(selected.command);
      } else if (input.trim()) {
        onSubmit(input.trim());
      }
      setInput("");
      setSelectedIndex(0);
      setCursorPosition(0);
      return;
    }

    // Handle tab for autocomplete (only in command mode)
    if (mode === "command" && key.tab && showSuggestions) {
      const selected = filteredSuggestions[selectedIndex];
      setInput(selected.command);
      setCursorPosition(selected.command.length);
      setSelectedIndex(0);
      return;
    }

    // Navigate suggestions with arrow keys (only in command mode)
    if (mode === "command" && key.upArrow && showSuggestions) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (mode === "command" && key.downArrow && showSuggestions) {
      setSelectedIndex((prev) =>
        Math.min(filteredSuggestions.length - 1, prev + 1)
      );
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        setInput((prev) => {
          const newInput =
            prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition);
          setCursorPosition(cursorPosition - 1);
          return newInput;
        });
        setSelectedIndex(0);
      }
      return;
    }

    // Handle left/right arrow keys
    if (key.leftArrow) {
      setCursorPosition((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition((prev) => Math.min(input.length, prev + 1));
      return;
    }

    // Add character to input
    if (inputChar && !key.ctrl && !key.meta) {
      setInput((prev) => {
        const newInput =
          prev.slice(0, cursorPosition) + inputChar + prev.slice(cursorPosition);
        setCursorPosition(cursorPosition + 1);
        return newInput;
      });
      setSelectedIndex(0);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Optional label (shown in description mode) */}
      {effectiveLabel && !input && (
        <Box marginBottom={1}>
          <Text dimColor>{effectiveLabel}</Text>
        </Box>
      )}

      {/* Placeholder hint (only when no input) */}
      {!effectiveLabel && !input && (
        <Box marginBottom={1}>
          <Text dimColor>{effectivePlaceholder}</Text>
        </Box>
      )}

      {/* Unified input box - SAME BOX for both modes */}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        flexDirection="column"
      >
        <Box>
          <Text color="green" bold>
            {mode === "command" ? "> " : "Describe: "}
          </Text>
          <Text>{input}</Text>
          <Text color="gray">▌</Text>
        </Box>
      </Box>

      {/* Suggestions dropdown (only in command mode) */}
      {mode === "command" && showSuggestions && (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          paddingY={1}
          flexDirection="column"
        >
          <Box marginBottom={1}>
            <Text dimColor>
              Suggestions (↑/↓ to navigate, Tab to complete, Enter to run):
            </Text>
          </Box>
          {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
            <Box key={suggestion.command} flexDirection="column">
              <Box>
                <Text
                  color={index === selectedIndex ? "cyan" : "gray"}
                  bold={index === selectedIndex}
                >
                  {index === selectedIndex ? "→ " : "  "}
                  {suggestion.command}
                </Text>
                {suggestion.description && (
                  <Text dimColor> - {suggestion.description}</Text>
                )}
              </Box>
              {index === selectedIndex && suggestion.usage && (
                <Box marginLeft={4}>
                  <Text dimColor>Usage: {suggestion.usage}</Text>
                </Box>
              )}
            </Box>
          ))}
          {filteredSuggestions.length > 5 && (
            <Box marginTop={1}>
              <Text dimColor>
                ... and {filteredSuggestions.length - 5} more
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Hints - different per mode */}
      <Box marginTop={1}>
        {mode === "command" ? (
          <Text dimColor>
            Press Ctrl+C to exit • Tab to autocomplete • / to see commands
          </Text>
        ) : (
          <Text dimColor>
            Press Enter to generate task • Ctrl+C to cancel
          </Text>
        )}
      </Box>

      {/* Provider and Model status - shown in both modes */}
      {(provider || model) && (
        <Box marginTop={0}>
          <Text dimColor>
            {provider && (
              <>
                <Text>Provider:</Text> <Text color="cyan">{provider}</Text>
              </>
            )}
            {provider && model && <Text dimColor> • </Text>}
            {model && (
              <>
                <Text>Model:</Text> <Text color="cyan">{model}</Text>
              </>
            )}
          </Text>
        </Box>
      )}
    </Box>
  );
}

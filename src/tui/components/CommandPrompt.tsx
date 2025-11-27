import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type CommandSuggestion = {
  command: string;
  description: string;
  usage?: string;
};

export type CommandPromptProps = {
  suggestions: CommandSuggestion[];
  onSubmit: (command: string) => void;
  onExit?: () => void;
  placeholder?: string;
  showWelcome?: boolean;
  provider?: string;
  model?: string;
};

export function CommandPrompt({
  suggestions,
  onSubmit,
  onExit,
  placeholder = "Type a command or /help for available commands",
  showWelcome = true,
  provider,
  model
}: CommandPromptProps) {
  const [input, setInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Filter suggestions based on input
  const filteredSuggestions = input.startsWith("/")
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
      if (showSuggestions && filteredSuggestions[selectedIndex]) {
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

    // Handle tab for autocomplete
    if (key.tab && showSuggestions) {
      const selected = filteredSuggestions[selectedIndex];
      setInput(selected.command);
      setCursorPosition(selected.command.length);
      setSelectedIndex(0);
      return;
    }

    // Navigate suggestions with arrow keys
    if (key.upArrow && showSuggestions) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow && showSuggestions) {
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
      {showWelcome && !input && (
        <Box marginBottom={1}>
          <Text dimColor>{placeholder}</Text>
        </Box>
      )}

      {/* Command input box */}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        flexDirection="column"
      >
        <Box>
          <Text color="green" bold>
            {"> "}
          </Text>
          <Text>{input}</Text>
          <Text color="gray">▌</Text>
        </Box>
      </Box>

      {/* Suggestions dropdown */}
      {showSuggestions && (
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

      {/* Hints */}
      <Box marginTop={1}>
        <Text dimColor>
          Press Ctrl+C to exit • Tab to autocomplete • / to see commands
        </Text>
      </Box>

      {/* Provider and Model status */}
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

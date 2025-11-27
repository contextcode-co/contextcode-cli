import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type SimpleSelectorOption = {
  label: string;
  value: string;
  description?: string;
};

export type SimpleSelectorProps = {
  title: string;
  subtitle?: string;
  options: SimpleSelectorOption[];
  currentValue?: string | null;
  onSelect: (value: string) => void;
  onCancel?: () => void;
  footer?: string;
};

export function SimpleSelector({
  title,
  subtitle,
  options,
  currentValue,
  onSelect,
  onCancel,
  footer
}: SimpleSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const currentIdx = options.findIndex((opt) => opt.value === currentValue);
    return currentIdx >= 0 ? currentIdx : 0;
  });

  useInput((input, key) => {
    // Handle Escape to cancel
    if (key.escape) {
      if (onCancel) {
        onCancel();
      }
      return;
    }

    // Handle number keys (1-9)
    if (input >= "1" && input <= "9") {
      const index = parseInt(input) - 1;
      if (index >= 0 && index < options.length) {
        setSelectedIndex(index);
        return;
      }
    }

    // Handle arrow keys
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
      return;
    }

    // Handle Enter to confirm
    if (key.return) {
      onSelect(options[selectedIndex].value);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {/* Separator */}
      <Box>
        <Text dimColor>{"─".repeat(150)}</Text>
      </Box>

      {/* Title */}
      <Box marginTop={1}>
        <Text bold> {title}</Text>
      </Box>

      {/* Subtitle */}
      {subtitle && (
        <Box marginTop={1}>
          <Text dimColor> {subtitle}</Text>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = option.value === currentValue;
          const number = index + 1;

          return (
            <Box key={option.value}>
              <Text color={isSelected ? "cyan" : "white"}>
                {isSelected ? " ❯ " : "   "}
                {number}. {option.label}
              </Text>
              {option.description && (
                <Text dimColor>   {option.description}</Text>
              )}
              {isCurrent && <Text color="green"> ✔</Text>}
            </Box>
          );
        })}
      </Box>

      {/* Footer hint */}
      <Box marginBottom={1}>
        <Text dimColor>
          {footer || " Enter to confirm · Esc to exit"}
        </Text>
      </Box>
    </Box>
  );
}

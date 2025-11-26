import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export type DescriptionPromptProps = {
  provider: string;
  model: string;
  placeholder?: string;
  initialValue?: string;
  label?: string;
  onSubmit: (value: string) => void;
};

export function DescriptionPrompt({
  provider,
  model,
  placeholder = "I want to implement...",
  initialValue = "",
  label = "Describe what you want to implement",
  onSubmit
}: DescriptionPromptProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(input: string) {
    const normalized = input.trim();
    onSubmit(normalized);
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
        <Text>{label}</Text>
        <Box marginTop={1}>
          <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} placeholder={placeholder} />
        </Box>
      </Box>
      <Box justifyContent="space-between" marginTop={1}>
        <Text color="blue">Provider: {provider || "(not set)"}</Text>
        <Text color="cyan">Model: {model || "(not set)"}</Text>
      </Box>
    </Box>
  );
}

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type TextInputProps = {
  placeholder?: string;
  onSubmit: (value: string) => void;
};

export function TextInput({ placeholder = "", onSubmit }: TextInputProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
    } else if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box>
      <Text>│  </Text>
      <Text>{value || placeholder}</Text>
      <Text color="magenta">▌</Text>
    </Box>
  );
}

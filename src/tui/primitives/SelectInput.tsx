import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

export type SelectInputProps = {
  options: SelectOption[];
  onSelect: (value: string) => void;
  onDelete?: (value: string) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
};

export function SelectInput({ options, onSelect, onDelete, showSearch = false, searchPlaceholder = "Search:" }: SelectInputProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const filteredOptions = searchQuery
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useInput((input, key) => {
    if (showSearch && !isSearching && input && !key.return && !key.upArrow && !key.downArrow && !key.escape) {
      setIsSearching(true);
      setSearchQuery(input);
      setSelectedIndex(0);
      return;
    }

    if (isSearching) {
      if (key.escape || (key.backspace && searchQuery.length === 0)) {
        setIsSearching(false);
        setSearchQuery("");
        setSelectedIndex(0);
      } else if (key.backspace || key.delete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
      } else if (key.return) {
        if (filteredOptions[selectedIndex]) {
          onSelect(filteredOptions[selectedIndex].value);
        }
      } else if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
      } else if (input && !key.ctrl && !key.meta) {
        setSearchQuery((prev) => prev + input);
        setSelectedIndex(0);
      }
    } else {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
      } else if (key.return) {
        if (filteredOptions[selectedIndex]) {
          onSelect(filteredOptions[selectedIndex].value);
        }
      } else if ((key.backspace || key.delete) && onDelete) {
        if (filteredOptions[selectedIndex]) {
          onDelete(filteredOptions[selectedIndex].value);
        }
      }
    }
  });

  return (
    <Box flexDirection="column">
      {showSearch && (
        <Box>
          <Text>│  </Text>
          <Text dimColor>{searchPlaceholder} </Text>
          <Text>{searchQuery}</Text>
          <Text color="magenta">▌</Text>
        </Box>
      )}
      {showSearch && (
        <Box>
          <Text>│</Text>
        </Box>
      )}
      {filteredOptions.map((option, index) => (
        <Box key={index}>
          <Text>│  </Text>
          <Text color={index === selectedIndex ? "cyan" : "gray"}>
            {index === selectedIndex ? "● " : "○ "}
          </Text>
          <Text color={index === selectedIndex ? "white" : "gray"}>
            {option.label}
          </Text>
          {option.description && (
            <Text dimColor> {option.description}</Text>
          )}
        </Box>
      ))}
      {showSearch && (
        <Box>
          <Text>│</Text>
        </Box>
      )}
      {showSearch && (
        <Box>
          <Text>│  </Text>
          <Text dimColor>↑/↓ to select • Enter: confirm • Type: to search</Text>
        </Box>
      )}
    </Box>
  );
}

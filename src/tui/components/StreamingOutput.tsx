import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

export type StreamingLine = {
  content: string;
  type?: "info" | "success" | "error" | "warning" | "default";
  timestamp?: Date;
};

export type StreamingOutputProps = {
  lines: StreamingLine[];
  isComplete?: boolean;
  title?: string;
  showTimestamps?: boolean;
};

export function StreamingOutput({
  lines,
  isComplete = false,
  title,
  showTimestamps = false
}: StreamingOutputProps) {
  const [visibleLines, setVisibleLines] = useState<StreamingLine[]>([]);
  const [currentLineChars, setCurrentLineChars] = useState(0);

  useEffect(() => {
    // Animate lines appearing one by one
    if (visibleLines.length < lines.length) {
      const timer = setTimeout(() => {
        setVisibleLines(lines.slice(0, visibleLines.length + 1));
        setCurrentLineChars(0);
      }, 50); // Delay between lines

      return () => clearTimeout(timer);
    } else if (
      visibleLines.length === lines.length &&
      lines.length > 0 &&
      currentLineChars < lines[lines.length - 1].content.length
    ) {
      // Animate characters in current line
      const timer = setTimeout(() => {
        setCurrentLineChars(currentLineChars + 1);
      }, 10); // Character animation speed

      return () => clearTimeout(timer);
    }
  }, [lines, visibleLines, currentLineChars]);

  const getLineColor = (type?: string) => {
    switch (type) {
      case "success":
        return "green";
      case "error":
        return "red";
      case "warning":
        return "yellow";
      case "info":
        return "cyan";
      default:
        return "white";
    }
  };

  const getLinePrefix = (type?: string) => {
    switch (type) {
      case "success":
        return "✓ ";
      case "error":
        return "✗ ";
      case "warning":
        return "⚠ ";
      case "info":
        return "ℹ ";
      default:
        return "";
    }
  };

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {title}
          </Text>
        </Box>
      )}

      {visibleLines.map((line, index) => {
        const isLastLine = index === visibleLines.length - 1;
        const content = isLastLine
          ? line.content.slice(0, currentLineChars)
          : line.content;

        return (
          <Box key={index} flexDirection="row">
            {showTimestamps && line.timestamp && (
              <Text dimColor>[{line.timestamp.toLocaleTimeString()}] </Text>
            )}
            <Text color={getLineColor(line.type)}>
              {getLinePrefix(line.type)}
              {content}
              {isLastLine && !isComplete && currentLineChars < line.content.length && (
                <Text color="cyan">▌</Text>
              )}
            </Text>
          </Box>
        );
      })}

      {!isComplete && visibleLines.length === lines.length && (
        <Box marginTop={1}>
          <Text dimColor>Generating...</Text>
        </Box>
      )}
    </Box>
  );
}

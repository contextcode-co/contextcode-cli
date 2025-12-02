import React from "react";
import { Box, Text } from "ink";

export type Step = {
  type: "title" | "complete" | "active" | "pending" | "info";
  label: string;
  value?: string;
};

export type PromptBoxProps = {
  title: string;
  steps: Step[];
  children?: React.ReactNode;
  footer?: string;
};

export function PromptBox({ title, steps, children, footer }: PromptBoxProps) {
  const activeStepIndex = steps.findIndex((s) => s.type === "active");

  return (
    <Box flexDirection="column">
      <Box>
        <Text>┌  </Text>
        <Text>{title}</Text>
      </Box>
      <Box>
        <Text>│</Text>
      </Box>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {step.type === "complete" && (
            <>
              <Box>
                <Text>◇  </Text>
                <Text dimColor>{step.label}</Text>
              </Box>
              {step.value && (
                <Box>
                  <Text>│  </Text>
                  <Text>{step.value}</Text>
                </Box>
              )}
            </>
          )}
          {step.type === "active" && (
            <>
              <Box>
                <Text>◆  </Text>
                <Text>{step.label}</Text>
              </Box>
              {children && (
                <>
                  <Box>
                    <Text> </Text>
                  </Box>
                  {children}
                </>
              )}
            </>
          )}
          {step.type === "pending" && (
            <Box>
              <Text>◆  </Text>
              <Text dimColor>{step.label}</Text>
            </Box>
          )}
          {step.type === "info" && (
            <>
              <Box>
                <Text>●  </Text>
                <Text>{step.label}</Text>
              </Box>
              {step.value && (
                <Box>
                  <Text>│  </Text>
                  <Text>{step.value}</Text>
                </Box>
              )}
            </>
          )}
          {index < steps.length - 1 && (
            <Box>
              <Text>│</Text>
            </Box>
          )}
        </React.Fragment>
      ))}
      {footer && (
        <>
          <Box>
            <Text>│</Text>
          </Box>
          <Box>
            <Text>│  </Text>
            <Text dimColor>{footer}</Text>
          </Box>
        </>
      )}
      <Box>
        <Text>└</Text>
      </Box>
    </Box>
  );
}

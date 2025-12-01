import React from "react";
import { Text } from "ink";
import { PromptBox } from "../PromptBox";
import { SelectInput } from "../SelectInput";


export type TaskListItem = {
  label: string;
  description?: string;
  content: string;
  relativePath: string;
};

export type TaskSelectorProps = {
  tasks: TaskListItem[];
  onSelect: (task: TaskListItem) => void;
};

export function TaskSelector({ tasks, onSelect }: TaskSelectorProps) {
  if (!tasks.length) {
    return (
      <PromptBox
        title="Tasks"
        steps={[
          {
            type: "active",
            label: "Select a task"
          }
        ]}
      >
        <Text>No tasks available.</Text>
      </PromptBox>
    );
  }

  return (
    <PromptBox
      title="Tasks"
      steps={[
        {
          type: "active",
          label: "Select a task"
        }
      ]}
      footer="Use ↑/↓ to navigate, Enter to copy"
    >
      <SelectInput
        options={tasks.map((task, index) => ({
          label: task.label,
          value: index.toString(),
          description: task.description ?? task.relativePath
        }))}
        onSelect={(value) => {
          const selected = tasks[Number(value)];
          if (selected) {
            onSelect(selected);
          }
        }}
        showSearch={tasks.length > 7}
        searchPlaceholder="Search tasks"
      />
    </PromptBox>
  );
}

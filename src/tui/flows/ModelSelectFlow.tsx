import React from "react";
import { render } from "ink";
import { PromptBox, Step } from "../layouts/PromptBox.js";
import { SelectInput } from "../primitives/SelectInput.js";

type ModelOption = {
  id: string;
  name: string;
  description?: string;
};

type ModelSelectFlowProps = {
  currentModel: string | null;
  models: ModelOption[];
  onComplete: (modelId: string) => void;
};

export function ModelSelectFlow({ currentModel, models, onComplete }: ModelSelectFlowProps) {
  const currentModelName = models.find((m) => m.id === currentModel)?.name || "(not set)";

  const steps: Step[] = [
    {
      type: "complete",
      label: "Current model",
      value: currentModelName,
    },
    { type: "active", label: "Select default model" },
  ];

  const handleSelect = (modelId: string) => {
    onComplete(modelId);
  };

  return (
    <PromptBox title="Model Configuration" steps={steps}>
      <SelectInput
        options={models.map((m) => ({
          label: m.name,
          value: m.id,
          description: m.description,
        }))}
        onSelect={handleSelect}
      />
    </PromptBox>
  );
}

export async function runModelSelectUI(currentModel: string | null, models: ModelOption[]): Promise<string> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ModelSelectFlow
        currentModel={currentModel}
        models={models}
        onComplete={(modelId) => {
          unmount();
          resolve(modelId);
        }}
      />
    );
  });
}

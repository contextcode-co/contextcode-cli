import React from "react";
import { render } from "ink";
import { PromptBox, type Step } from "../layouts/PromptBox.js";
import { SelectInput } from "../primitives/SelectInput.js";

export type ProviderOption = {
  id: string;
  title: string;
  description?: string;
};

type ProviderSelectFlowProps = {
  currentProviderId: string | null;
  providers: ProviderOption[];
  onComplete: (providerId: string) => void;
};

export function ProviderSelectFlow({ currentProviderId, providers, onComplete }: ProviderSelectFlowProps) {
  const currentLabel = providers.find((provider) => provider.id === currentProviderId)?.title ?? "(not set)";

  const steps: Step[] = [
    {
      type: "complete",
      label: "Current provider",
      value: currentLabel,
    },
    {
      type: "active",
      label: "Select provider",
    },
  ];

  return (
    <PromptBox title="Provider configuration" steps={steps}>
      <SelectInput
        options={providers.map((provider) => ({
          label: provider.title,
          value: provider.id,
          description: provider.description,
        }))}
        onSelect={onComplete}
        showSearch={providers.length > 5}
        searchPlaceholder="Search providers"
      />
    </PromptBox>
  );
}

export async function runProviderSelectUI(currentProviderId: string | null, providers: ProviderOption[]): Promise<string> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ProviderSelectFlow
        currentProviderId={currentProviderId}
        providers={providers}
        onComplete={(providerId) => {
          unmount();
          resolve(providerId);
        }}
      />
    );
  });
}

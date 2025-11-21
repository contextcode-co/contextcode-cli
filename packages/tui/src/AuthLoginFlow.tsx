import React, { useState } from "react";
import { render } from "ink";
import { PromptBox, Step } from "./PromptBox.js";
import { SelectInput } from "./SelectInput.js";
import { TextInput } from "./TextInput.js";

type AuthMethod = {
  label: string;
  authorize: () => Promise<{
    url: string;
    instructions: string;
    callback: (code: string) => Promise<void>;
  }>;
};

type AuthLoginFlowProps = {
  providers: Array<{ id: string; title: string; description: string }>;
  onProviderSelect: (providerId: string) => Promise<{
    methods: AuthMethod[];
  }>;
  onComplete: (result: { providerId: string; methodIndex: number }) => void;
};

export function AuthLoginFlow({ providers, onProviderSelect, onComplete }: AuthLoginFlowProps) {
  const [stage, setStage] = useState<"provider" | "method" | "code">("provider");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedProviderTitle, setSelectedProviderTitle] = useState<string>("");
  const [methods, setMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
  const [selectedMethodLabel, setSelectedMethodLabel] = useState<string>("");
  const [authUrl, setAuthUrl] = useState<string>("");
  const [authInstructions, setAuthInstructions] = useState<string>("");
  const [authCallback, setAuthCallback] = useState<((code: string) => Promise<void>) | null>(null);

  const steps: Step[] = [];

  if (stage === "provider") {
    steps.push({ type: "active", label: "Select provider" });
  } else {
    steps.push({ type: "complete", label: "Select provider", value: selectedProviderTitle });
  }

  if (stage === "method") {
    steps.push({ type: "active", label: "Login method" });
  } else if (selectedMethod !== null) {
    steps.push({ type: "complete", label: "Login method", value: selectedMethodLabel });
  }

  if (stage === "code") {
    steps.push({ type: "active", label: `Go to: ${authUrl}` });
    steps.push({ type: "pending", label: authInstructions });
  }

  const handleProviderSelect = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setSelectedProvider(providerId);
    setSelectedProviderTitle(provider.title);

    const result = await onProviderSelect(providerId);
    setMethods(result.methods);
    setStage("method");
  };

  const handleMethodSelect = async (methodIndex: number) => {
    setSelectedMethod(methodIndex);
    setSelectedMethodLabel(methods[methodIndex].label);

    const authInfo = await methods[methodIndex].authorize();
    setAuthUrl(authInfo.url);
    setAuthInstructions(authInfo.instructions);
    setAuthCallback(() => authInfo.callback);
    setStage("code");
  };

  const handleCodeSubmit = async (code: string) => {
    if (authCallback) {
      await authCallback(code);
    }
    onComplete({
      providerId: selectedProvider!,
      methodIndex: selectedMethod!
    });
  };

  return (
    <PromptBox title="Add credential" steps={steps}>
      {stage === "provider" && (
        <SelectInput
          options={providers.map((p) => ({ 
            label: p.title, 
            value: p.id,
            description: p.description ? `(${p.description})` : undefined
          }))}
          onSelect={handleProviderSelect}
          showSearch={providers.length > 5}
          searchPlaceholder="Search:"
        />
      )}
      {stage === "method" && (
        <SelectInput
          options={methods.map((m, i) => ({ label: m.label, value: String(i) }))}
          onSelect={(val) => handleMethodSelect(Number(val))}
        />
      )}
      {stage === "code" && <TextInput onSubmit={handleCodeSubmit} />}
    </PromptBox>
  );
}

export async function runAuthLoginUI(
  providers: Array<{ id: string; title: string; description: string }>,
  onProviderSelect: (providerId: string) => Promise<{
    methods: AuthMethod[];
  }>
): Promise<{ providerId: string; methodIndex: number }> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <AuthLoginFlow
        providers={providers}
        onProviderSelect={onProviderSelect}
        onComplete={(result) => {
          unmount();
          resolve(result);
        }}
      />
    );
  });
}

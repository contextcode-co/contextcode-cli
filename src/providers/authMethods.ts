import type { ProviderFactoryOptions } from "./provider.js";

export type AuthMethod = {
  label: string;
  authorize: () => Promise<{
    url: string;
    instructions: string;
    callback: (code: string) => Promise<void>;
  }>;
};

const authMethodsRegistry = new Map<string, () => Promise<{ methods: AuthMethod[] }>>();

export function registerAuthMethods(providerId: string, getMethodsFn: () => Promise<{ methods: AuthMethod[] }>) {
  authMethodsRegistry.set(providerId, getMethodsFn);
}

export async function getProviderAuthMethods(providerId: string): Promise<{ methods: AuthMethod[] }> {
  const fn = authMethodsRegistry.get(providerId);
  if (!fn) {
    return { methods: [] };
  }
  return await fn();
}

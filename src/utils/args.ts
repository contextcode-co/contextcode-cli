export type FlagDefinition = {
  name: string;
  alias?: string;
  type: "string" | "boolean";
  multiple?: boolean;
};

export class ArgError extends Error {}

type FlagValue = string | string[] | boolean | undefined;

function toCamelCase(name: string) {
  return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

export function parseArgs(argv: string[], definitions: FlagDefinition[]) {
  const longLookup = new Map<string, FlagDefinition>();
  const shortLookup = new Map<string, FlagDefinition>();

  for (const def of definitions) {
    longLookup.set(`--${def.name}`, def);
    if (def.alias) {
      shortLookup.set(`-${def.alias}`, def);
    }
  }

  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];

  const assignValue = (def: FlagDefinition, raw: string | boolean) => {
    const key = toCamelCase(def.name);
    if (def.multiple) {
      const existing = (flags[key] as string[] | undefined) ?? [];
      if (typeof raw === "boolean") {
        throw new ArgError(`Flag --${def.name} expects a value.`);
      }
      flags[key] = [...existing, raw];
      return;
    }
    flags[key] = raw;
  };

  const getDefinition = (token: string) => {
    if (longLookup.has(token)) return longLookup.get(token)!;
    if (shortLookup.has(token)) return shortLookup.get(token)!;
    return null;
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }

    const [flagToken, inlineValue] = token.includes("=") ? token.split(/=(.+)/) : [token, undefined];
    const def = getDefinition(flagToken);
    if (!def) {
      throw new ArgError(`Unknown option: ${flagToken}`);
    }

    if (def.type === "boolean") {
      if (inlineValue !== undefined) {
        assignValue(def, !/^false$/i.test(inlineValue));
      } else {
        assignValue(def, true);
      }
      continue;
    }

    const nextValue = inlineValue ?? argv[++i];
    if (!nextValue) {
      throw new ArgError(`Option ${flagToken} expects a value.`);
    }
    assignValue(def, nextValue);
  }

  return { flags, positionals };
}

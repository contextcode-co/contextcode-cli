import type { CommandSuggestion } from "../tui/components/CommandPrompt.js";

export type CommandHandler = {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: "task" | "config" | "auth" | "help";
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>;
};

export type CommandContext = {
  cwd: string;
  interactive: boolean;
  userConfig: any;
};

export type CommandResult = {
  success: boolean;
  message?: string;
  data?: any;
  shouldExit?: boolean;
};

export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();

  register(handler: CommandHandler) {
    this.commands.set(handler.name, handler);
    if (handler.aliases) {
      handler.aliases.forEach((alias) => {
        this.commands.set(alias, handler);
      });
    }
  }

  get(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandHandler[] {
    // Return unique handlers (not aliases)
    const unique = new Map<string, CommandHandler>();
    this.commands.forEach((handler) => {
      if (!unique.has(handler.name)) {
        unique.set(handler.name, handler);
      }
    });
    return Array.from(unique.values());
  }

  getSuggestions(): CommandSuggestion[] {
    return this.getAll().map((handler) => ({
      command: `/${handler.name}`,
      description: handler.description,
      usage: handler.usage
    }));
  }

  async execute(
    commandLine: string,
    context: CommandContext
  ): Promise<CommandResult> {
    const trimmed = commandLine.trim();

    // Remove leading slash if present
    const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;

    // Parse command and arguments
    const parts = normalized.split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const handler = this.get(commandName);
    if (!handler) {
      return {
        success: false,
        message: `Unknown command: ${commandName}. Type /help for available commands.`
      };
    }

    try {
      return await handler.execute(args, context);
    } catch (error: any) {
      return {
        success: false,
        message: `Error executing ${commandName}: ${error.message}`
      };
    }
  }
}

// Global registry instance
export const commandRegistry = new CommandRegistry();

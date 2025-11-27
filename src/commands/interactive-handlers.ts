import type { CommandHandler, CommandContext, CommandResult } from "../shared/command-registry.js";
import { runInitCommand } from "./init.js";
import { runGenerateTaskCommand } from "./generate-task.js";
import { runAuthCommand } from "./auth.js";

export const initHandler: CommandHandler = {
  name: "init",
  aliases: ["index", "scan"],
  description: "Index the current repository and generate context documentation",
  usage: "/init [path] [--no-context-docs] [-p provider] [-m model]",
  category: "task",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      await runInitCommand(args);
      return {
        success: true,
        message: "Repository indexed successfully!"
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};

export const generateTaskHandler: CommandHandler = {
  name: "generate",
  aliases: ["task", "gen", "plan"],
  description: "Generate a task implementation plan",
  usage: "/generate task [-p \"task description\"] [--provider provider] [--model model]",
  category: "task",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      // If first arg is "task", pass remaining args
      const taskArgs = args[0] === "task" ? args.slice(1) : args;
      await runGenerateTaskCommand(taskArgs);
      return {
        success: true,
        message: "Task generated successfully!"
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};

export const loginHandler: CommandHandler = {
  name: "login",
  aliases: ["auth"],
  description: "Authenticate with an AI provider",
  usage: "/login",
  category: "auth",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      await runAuthCommand(["login", ...args]);
      return {
        success: true,
        message: "Authentication successful!"
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};

export const setProviderHandler: CommandHandler = {
  name: "provider",
  aliases: ["set-provider"],
  description: "Set the default AI provider",
  usage: "/provider",
  category: "config",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      // Import dependencies inline to avoid circular dependencies
      const { readUserConfig, updateUserConfig } = await import("../shared/user-config.js");
      const { loadCredentialProviders } = await import("../utils/credentials.js");
      const { runProviderSelectUI } = await import("../tui/index.js");

      const providers = await loadCredentialProviders();
      if (!providers.length) {
        return {
          success: false,
          message: "No providers found. Run /login first to authenticate with a provider."
        };
      }

      const userConfig = await readUserConfig();

      // Run the selection UI - this will temporarily take over the terminal
      const chosenProviderId = await runProviderSelectUI(
        userConfig.defaultProvider ?? null,
        providers.map((provider) => ({
          id: provider.id,
          title: provider.title,
          description: provider.description
        }))
      );

      const selectedProvider = providers.find((p) => p.id === chosenProviderId);
      if (!selectedProvider) {
        return {
          success: false,
          message: `Unknown provider: ${chosenProviderId}`
        };
      }

      await updateUserConfig({
        defaultProvider: selectedProvider.id,
        defaultModel: selectedProvider.defaultModel
      });

      return {
        success: true,
        message: `Provider set to ${selectedProvider.title} (model: ${selectedProvider.defaultModel})`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};

export const setModelHandler: CommandHandler = {
  name: "model",
  aliases: ["set-model"],
  description: "Set the default model for the current provider",
  usage: "/model",
  category: "config",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    try {
      // Import dependencies inline
      const { readUserConfig, updateUserConfig } = await import("../shared/user-config.js");
      const { getProviderMetadata, normalizeModelForProvider } = await import("../types/providers.js");
      const { runModelSelectUI } = await import("../tui/index.js");

      const userConfig = await readUserConfig();
      const providerId = userConfig.defaultProvider;

      if (!providerId) {
        return {
          success: false,
          message: "No default provider configured. Run /provider first."
        };
      }

      const metadata = getProviderMetadata(providerId);
      if (!metadata) {
        return {
          success: false,
          message: `Unknown provider "${providerId}". Run /provider to reconfigure.`
        };
      }

      const normalized = normalizeModelForProvider(providerId, userConfig.defaultModel);
      const modelOptions = metadata.models.map((model) => ({
        id: model.id,
        name: model.label,
        description: model.description
      }));

      // Run the selection UI
      const selectedModelId = await runModelSelectUI(normalized.model ?? null, modelOptions);

      await updateUserConfig({
        defaultProvider: providerId,
        defaultModel: selectedModelId
      });

      const selectedModel = metadata.models.find((m) => m.id === selectedModelId);

      return {
        success: true,
        message: `Model set to ${selectedModel?.label ?? selectedModelId}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
};

export const helpHandler: CommandHandler = {
  name: "help",
  aliases: ["?", "commands"],
  description: "Show available commands and their usage",
  usage: "/help [command]",
  category: "help",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const { commandRegistry } = await import("../shared/command-registry.js");

    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0].replace(/^\//, "");
      const handler = commandRegistry.get(commandName);

      if (!handler) {
        return {
          success: false,
          message: `Unknown command: ${commandName}`
        };
      }

      console.log(`\n${handler.name} - ${handler.description}`);
      if (handler.usage) {
        console.log(`Usage: ${handler.usage}`);
      }
      if (handler.aliases && handler.aliases.length > 0) {
        console.log(`Aliases: ${handler.aliases.map(a => `/${a}`).join(", ")}`);
      }
      console.log();

      return {
        success: true
      };
    }

    // Show all commands grouped by category
    const allHandlers = commandRegistry.getAll();
    const categories = {
      task: "Task Generation",
      config: "Configuration",
      auth: "Authentication",
      help: "Help"
    };

    console.log("\nAvailable Commands:\n");

    for (const [category, title] of Object.entries(categories)) {
      const handlers = allHandlers.filter(h => h.category === category);
      if (handlers.length === 0) continue;

      console.log(`${title}:`);
      handlers.forEach(handler => {
        const aliases = handler.aliases ? ` (${handler.aliases.map(a => `/${a}`).join(", ")})` : "";
        console.log(`  /${handler.name}${aliases}`);
        console.log(`    ${handler.description}`);
      });
      console.log();
    }

    console.log("Type /help <command> for more information about a specific command.\n");

    return {
      success: true
    };
  }
};

export const exitHandler: CommandHandler = {
  name: "exit",
  aliases: ["quit", "q"],
  description: "Exit the interactive session",
  usage: "/exit",
  category: "help",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    return {
      success: true,
      message: "Goodbye!",
      shouldExit: true
    };
  }
};

export const clearHandler: CommandHandler = {
  name: "clear",
  aliases: ["cls"],
  description: "Clear the terminal screen",
  usage: "/clear",
  category: "help",
  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    console.clear();
    return {
      success: true
    };
  }
};

export const tasksHandler: CommandHandler = {
  name: "tasks",
  aliases: ["list-tasks"],
  description: "List and select tasks to copy to clipboard",
  usage: "/tasks",
  category: "task",
  async execute(_args: string[], _context: CommandContext): Promise<CommandResult> {
    // This command is handled directly in InteractiveSession
    // The state machine will show the task selector
    return {
      success: true
    };
  }
};

import React from "react";
import { render } from "ink";
import { InteractiveSession } from "../tui/InteractiveSession.js";
import { readUserConfig } from "../shared/user-config.js";
import { commandRegistry } from "../shared/command-registry.js";
import {
  initHandler,
  generateTaskHandler,
  loginHandler,
  setProviderHandler,
  setModelHandler,
  helpHandler,
  exitHandler,
  clearHandler,
  tasksHandler
} from "./interactive-handlers.js";

// Register all commands
export function registerCommands() {
  commandRegistry.register(initHandler);
  commandRegistry.register(generateTaskHandler);
  commandRegistry.register(loginHandler);
  commandRegistry.register(setProviderHandler);
  commandRegistry.register(setModelHandler);
  commandRegistry.register(tasksHandler);
  commandRegistry.register(helpHandler);
  commandRegistry.register(exitHandler);
  commandRegistry.register(clearHandler);
}

export async function runInteractiveMode(cwd: string = process.cwd()) {
  // Register all commands first
  registerCommands();

  // Load user config
  const userConfig = await readUserConfig();

  const context = {
    cwd,
    interactive: true,
    userConfig
  };

  // Render the interactive session - it handles all state internally
  const { unmount, waitUntilExit } = render(
    React.createElement(InteractiveSession, {
      context,
      onExit: () => {
        unmount();
      },
      onCommandComplete: (_command: string, _success: boolean) => {
        // Optional: Log command history, analytics, etc.
      }
    })
  );

  await waitUntilExit();
  console.log("\nGoodbye! 👋");
}

import React from "react";
import { render } from "ink";
import { getTasks, deleteTask, type TaskFile } from "../shared/tasks";
import { parseArgs } from "../utils/args.js";
import { resolveWorkingDirectory } from "../utils/json.js";
import { isInteractiveSession } from "../utils/prompt.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { TaskListItem, TaskSelector } from "src/tui";

const flagDefinitions = [{ name: "cwd", alias: "C", type: "string" as const }];

export type TaskSelectorResult = {
  action: "select" | "delete";
  task: TaskFile;
};

export type RunTaskCommandOptions = {
  interactive?: boolean;
  loadTasks?: (cwd: string) => Promise<TaskFile[]>;
  selectTask?: (tasks: TaskFile[]) => Promise<TaskSelectorResult | undefined>;
  copyTask?: (content: string) => Promise<void>;
  deleteTask?: (absolutePath: string) => Promise<void>;
  cwd?: string;
};

export async function runTaskCommand(argv: string[], options: RunTaskCommandOptions = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const { flags } = parseArgs(argv, flagDefinitions);
  const cwdOverride = flags.cwd as string | undefined;
  const baseDir = resolveWorkingDirectory(options.cwd ?? process.cwd(), cwdOverride);

  const interactive = options.interactive ?? isInteractiveSession();
  if (!interactive) {
    throw new Error("The task command requires an interactive terminal.");
  }

  const fetchTasks = options.loadTasks ?? getTasks;
  const tasks = await fetchTasks(baseDir);
  if (!tasks.length) {
    console.log("No tasks found. Add markdown files under .contextcode/tasks.");
    return;
  }

  const selectTask = options.selectTask ?? runTaskSelector;
  const result = await selectTask(tasks);
  if (!result) {
    console.log("Task selection cancelled.");
    return;
  }

  if (result.action === "delete") {
    const removeTask = options.deleteTask ?? deleteTask;
    await removeTask(result.task.absolutePath);
    console.log(`Deleted task: ${result.task.label} (${result.task.relativePath})`);
    
    // Reload and continue selection if there are more tasks
    const remainingTasks = await fetchTasks(baseDir);
    if (remainingTasks.length > 0) {
      // Re-run the command to show remaining tasks
      return runTaskCommand(argv, options);
    }
    return;
  }

  const copyTask = options.copyTask ?? copyToClipboard;
  await copyTask(result.task.content);
  console.log(`Copied ${result.task.label} (${result.task.relativePath}) to the clipboard.`);
}

async function runTaskSelector(tasks: TaskFile[]) {
  return new Promise<TaskSelectorResult | undefined>((resolve) => {
    let result: TaskSelectorResult | undefined;
    const listItems: TaskListItem[] = tasks.map((task) => ({
      label: task.label,
      description: task.relativePath,
      content: task.content,
      relativePath: task.relativePath
    }));
    const { unmount, waitUntilExit } = render(
      React.createElement(TaskSelector, {
        tasks: listItems,
        onSelect: (task) => {
          const index = listItems.indexOf(task);
          if (index >= 0) {
            result = { action: "select", task: tasks[index] };
          }
          unmount();
        },
        onDelete: (task) => {
          const index = listItems.indexOf(task);
          if (index >= 0) {
            result = { action: "delete", task: tasks[index] };
          }
          unmount();
        }
      })
    );

    waitUntilExit().finally(() => {
      resolve(result);
    });
  });
}

function printHelp() {
  console.log(`Usage: contextcode task [options]\n\nList available tasks from .contextcode/tasks and copy the selected task to your clipboard.\n\nOptions:\n  -C, --cwd <path>  Directory to scan for tasks\n  -h, --help        Show this help text`);
}

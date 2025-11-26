import React from "react";
import { render } from "ink";
import { getTasks, type TaskFile } from "../shared/tasks";
import { parseArgs } from "../utils/args.js";
import { resolveWorkingDirectory } from "../utils/json.js";
import { isInteractiveSession } from "../utils/prompt.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { TaskListItem, TaskSelector } from "src/tui";

const flagDefinitions = [{ name: "cwd", alias: "C", type: "string" as const }];

export type RunTaskCommandOptions = {
  interactive?: boolean;
  loadTasks?: (cwd: string) => Promise<TaskFile[]>;
  selectTask?: (tasks: TaskFile[]) => Promise<TaskFile | undefined>;
  copyTask?: (content: string) => Promise<void>;
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
    console.log("No tasks found. Add markdown files under .context/tasks.");
    return;
  }

  const selectTask = options.selectTask ?? runTaskSelector;
  const selectedTask = await selectTask(tasks);
  if (!selectedTask) {
    console.log("Task selection cancelled.");
    return;
  }

  const copyTask = options.copyTask ?? copyToClipboard;
  await copyTask(selectedTask.content);
  console.log(`Copied ${selectedTask.label} (${selectedTask.relativePath}) to the clipboard.`);
}

async function runTaskSelector(tasks: TaskFile[]) {
  return new Promise<TaskFile | undefined>((resolve) => {
    let chosen: TaskFile | undefined;
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
            chosen = tasks[index];
          }
          unmount();
        }
      })
    );

    waitUntilExit().finally(() => {
      resolve(chosen);
    });
  });
}

function printHelp() {
  console.log(`Usage: contextcode task [options]\n\nList available tasks from .context/tasks and copy the selected task to your clipboard.\n\nOptions:\n  -C, --cwd <path>  Directory to scan for tasks\n  -h, --help        Show this help text`);
}

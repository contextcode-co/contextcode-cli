import fs from "node:fs/promises";
import path from "node:path";

import { globby } from "globby";
import { pathExists } from "fs-extra";

const DEFAULT_TASKS_DIR = path.join(".context", "tasks");
const MARKDOWN_GLOBS = ["**/*.md", "**/*.mdx"];
const HEADING_REGEX = /^#\s+(.+)$/m;

export type TaskFile = {
  label: string;
  relativePath: string;
  absolutePath: string;
  content: string;
};

export async function getTasks(baseDir = process.cwd()): Promise<TaskFile[]> {
  const tasksDir = path.resolve(baseDir, DEFAULT_TASKS_DIR);
  const hasTasksDir = await pathExists(tasksDir);
  if (!hasTasksDir) return [];

  const taskFiles = await globby(MARKDOWN_GLOBS, {
    cwd: tasksDir,
    absolute: true,
    followSymbolicLinks: false
  });

  const tasks: TaskFile[] = [];

  for (const filePath of taskFiles.sort()) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(baseDir, filePath);
    const headingMatch = content.match(HEADING_REGEX);
    const label = headingMatch?.[1]?.trim() || path.relative(tasksDir, filePath);
    tasks.push({
      label,
      relativePath,
      absolutePath: filePath,
      content
    });
  }

  return tasks;
}

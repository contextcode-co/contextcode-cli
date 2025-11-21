import { spawnSync } from "node:child_process";

export function isGitRepository(cwd: string) {
  try {
    const res = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, stdio: "ignore" });
    return res.status === 0;
  } catch {
    return false;
  }
}

import { spawnSync } from "node:child_process";

export function createBranchAndCommit(cwd: string, branchName: string, message: string) {
    // create branch
    spawnSync("git", ["checkout", "-b", branchName], { cwd, stdio: "inherit" })

    // add context-docs
    spawnSync("git", ["add", "context-docs"], { cwd, stdio: "inherit" })

    //commit 
    const res = spawnSync("git", ["commit", "-m", message], { cwd, stdio: "inherit" })
    if (res.status !== 0) {
        throw new Error("git commit failed")
    }

    return branchName
}
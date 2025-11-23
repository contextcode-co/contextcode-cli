import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export function isInteractiveSession() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptYesNo(question: string, defaultYes = true) {
  if (!isInteractiveSession()) {
    return defaultYes;
  }

  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} ${hint} `)).trim();
    if (!answer) return defaultYes;
    if (/^(y|yes)$/i.test(answer)) return true;
    if (/^(n|no)$/i.test(answer)) return false;
    return defaultYes;
  } finally {
    rl.close();
  }
}

export async function promptText(question: string): Promise<string> {
  if (!isInteractiveSession()) {
    throw new Error("Interactive prompt not available. Pass --prompt to provide the task description.");
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question}\n> `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

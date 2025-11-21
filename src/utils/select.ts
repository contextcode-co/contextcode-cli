import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type SelectOption<T = string> = {
  label: string;
  value: T;
  description?: string;
};

export async function selectFromList<T>(options: SelectOption<T>[], promptMessage = "Choose an option:") {
  if (!options.length) {
    throw new Error("No options available to select.");
  }
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Interactive selection requires a TTY environment.");
  }

  options.forEach((option, index) => {
    const suffix = option.description ? ` — ${option.description}` : "";
    console.log(`  ${index + 1}) ${option.label}${suffix}`);
  });

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const answer = (await rl.question(`${promptMessage} `)).trim();
      const index = Number.parseInt(answer, 10);
      if (!Number.isNaN(index) && index >= 1 && index <= options.length) {
        return options[index - 1];
      }
      console.log(`Enter a number between 1 and ${options.length}.`);
    }
  } finally {
    rl.close();
  }
}

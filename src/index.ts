import "dotenv/config";
import * as readline from "readline";
import chalk from "chalk";
import { renderMap } from "./map";
import { chat } from "./agent";
import { mapState } from "./tools";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const HELP = `
${chalk.bold("Deskmate")} — coworking space AI agent

Example commands:
  What desks are free today?
  Book desk D02 for Ana tomorrow
  Book a quiet desk for Bob this afternoon
  Cancel Ana's booking today
  Show map for tomorrow
  Add member João, email joao@example.com, prefers quiet and monitor
  Who has desk D03 today?

Type ${chalk.cyan("exit")} or ${chalk.cyan("quit")} to leave.
`;

async function main() {
  console.clear();
  console.log(HELP);

  let history: MessageParam[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    renderMap(mapState.date);
    rl.question(chalk.cyan("\nYou: "), async (input) => {
      const line = input.trim();
      if (!line) return prompt();
      if (line === "exit" || line === "quit") {
        rl.close();
        process.exit(0);
      }

      try {
        const { response, history: newHistory } = await chat(history, line);
        history = newHistory;
        console.clear();
        console.log(chalk.bold.green("\nDeskmate: ") + response + "\n");
      } catch (err) {
        console.error(chalk.red("Error:"), err);
      }

      prompt();
    });
  };

  prompt();
}

main();

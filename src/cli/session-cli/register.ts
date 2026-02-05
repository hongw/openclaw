import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { registerSessionListCommand } from "./register.session-list.js";
import { registerSessionRemoveCommand } from "./register.session-remove.js";

export function registerSessionCli(program: Command) {
  const session = program
    .command("session")
    .description("Manage conversation session store")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
    );

  registerSessionListCommand(session);
  registerSessionRemoveCommand(session);
}

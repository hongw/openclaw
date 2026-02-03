import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { registerSessionsListCommand } from "./register.sessions-list.js";
import { registerSessionsRemoveCommand } from "./register.sessions-remove.js";

export function registerSessionsCli(program: Command) {
  const sessions = program
    .command("sessions")
    .description("Manage conversation sessions")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
    );

  registerSessionsListCommand(sessions);
  registerSessionsRemoveCommand(sessions);
}

import type { Command } from "commander";
import { sessionsCommand } from "../../commands/sessions.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";

export function registerSessionListCommand(parent: Command) {
  parent
    .command("list", { isDefault: true })
    .aliases(["ls"])
    .description("List stored conversation sessions")
    .option("--json", "Output as JSON", false)
    .option("--verbose", "Verbose logging", false)
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--active <minutes>", "Only show sessions updated within the past N minutes")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw session", "List all sessions."],
          ["openclaw session list", "List all sessions (explicit)."],
          ["openclaw session --active 120", "Only last 2 hours."],
          ["openclaw session --json", "Machine-readable output."],
          ["openclaw session --store ./tmp/sessions.json", "Use a specific session store."],
        ])}\n\n${theme.muted(
          "Shows token usage per session when the agent reports it; set agents.defaults.contextTokens to see % of your model window.",
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
}

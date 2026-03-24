import type { Command } from "commander";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import { addGatewayClientOptions, callGatewayFromCli } from "./shared.js";

export function registerSessionRemoveCommand(parent: Command) {
  const cmd = parent
    .command("remove <key>")
    .aliases(["rm", "delete"])
    .description("Remove a session (matches Portal delete)")
    .option("--json", "Output JSON", false)
    .option("--verbose", "Verbose logging", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw session remove cron:job123", "Remove a cron session."],
          ["openclaw session rm telegram:user:5568782822", "Remove by key (short alias)."],
        ])}`,
    )
    .action(async (key: string, opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionRemoveCommand(
        {
          key: key.trim(),
          json: Boolean(opts.json),
          ...opts,
        },
        defaultRuntime,
      );
    });

  addGatewayClientOptions(cmd);
}

async function sessionRemoveCommand(
  opts: {
    key: string;
    json?: boolean;
    url?: string;
    token?: string;
    timeout?: string;
  },
  runtime: typeof defaultRuntime,
) {
  const key = opts.key;
  if (!key) {
    runtime.error("Session key is required.");
    runtime.exit(1);
    return;
  }

  try {
    const result = await callGatewayFromCli(
      "sessions.delete",
      opts,
      {
        key,
        // Portal delete uses deleteTranscript=true, which archives transcript files.
        deleteTranscript: true,
      },
    );

    const typedResult = result as {
      ok: boolean;
      key: string;
      deleted: boolean;
      archived?: string[];
    };

    if (opts.json) {
      runtime.log(JSON.stringify(typedResult, null, 2));
    } else {
      if (typedResult.deleted) {
        runtime.log(theme.success(`✓ Removed session: ${typedResult.key}`));
        if (typedResult.archived && typedResult.archived.length > 0) {
          for (const path of typedResult.archived) {
            runtime.log(theme.muted(`  Archived: ${path}`));
          }
        }
      } else {
        runtime.log(theme.warn(`Session not found: ${key}`));
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      runtime.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      runtime.error(`Failed to remove session: ${msg}`);
    }
    runtime.exit(1);
  }
}

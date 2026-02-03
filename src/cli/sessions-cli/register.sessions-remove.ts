import type { Command } from "commander";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import { addGatewayConnectionOptions, resolveGatewayConnection } from "./shared.js";

export function registerSessionsRemoveCommand(parent: Command) {
  const cmd = parent
    .command("remove <key>")
    .aliases(["rm", "delete"])
    .description("Remove a session (archives transcript)")
    .option("--keep-transcript", "Do not archive/delete the transcript file", false)
    .option("--json", "Output JSON", false)
    .option("--verbose", "Verbose logging", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw sessions remove cron:job123", "Remove a cron session."],
          ["openclaw sessions rm telegram:user:5568782822", "Remove by key (short alias)."],
          ["openclaw sessions remove --keep-transcript cron:job123", "Remove but keep transcript."],
        ])}`,
    )
    .action(async (key: string, opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsRemoveCommand(
        {
          key,
          keepTranscript: Boolean(opts.keepTranscript),
          json: Boolean(opts.json),
          url: opts.url as string | undefined,
          token: opts.token as string | undefined,
          timeoutMs: opts.timeout ? Number.parseInt(opts.timeout as string, 10) : undefined,
        },
        defaultRuntime,
      );
    });

  addGatewayConnectionOptions(cmd);
}

async function sessionsRemoveCommand(
  opts: {
    key: string;
    keepTranscript?: boolean;
    json?: boolean;
    url?: string;
    token?: string;
    timeoutMs?: number;
  },
  runtime: typeof defaultRuntime,
) {
  const { callGateway } = await import("../../gateway/call.js");

  const key = opts.key.trim();
  if (!key) {
    runtime.error("Session key is required.");
    runtime.exit(1);
    return;
  }

  const conn = resolveGatewayConnection(opts);

  try {
    const result = await callGateway<{
      ok: boolean;
      key: string;
      deleted: boolean;
      archived: string[];
    }>({
      method: "sessions.delete",
      params: {
        key,
        deleteTranscript: !opts.keepTranscript,
      },
      url: conn.url,
      token: conn.token,
      timeoutMs: opts.timeoutMs ?? 15_000,
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
    } else {
      if (result.deleted) {
        runtime.log(theme.success(`✓ Removed session: ${result.key}`));
        if (result.archived && result.archived.length > 0) {
          for (const path of result.archived) {
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

import type { Command } from "commander";
import { loadConfig } from "../../config/config.js";
import { resolveGatewayRemoteUrl } from "../../config/remote.js";

export function addGatewayConnectionOptions(cmd: Command) {
  cmd
    .option(
      "--url <url>",
      "Gateway WebSocket URL (defaults to gateway.remote.url when configured)",
    )
    .option("--token <token>", "Gateway token (if required)")
    .option("--timeout <ms>", "Timeout in ms", "15000");
}

export function resolveGatewayConnection(opts: { url?: string; token?: string }) {
  const cfg = loadConfig();
  const url = opts.url?.trim() || resolveGatewayRemoteUrl(cfg) || "ws://127.0.0.1:18789";
  const token = opts.token?.trim() || cfg.gateway?.remote?.token;
  return { url, token };
}

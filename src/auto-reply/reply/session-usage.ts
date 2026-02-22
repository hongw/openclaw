import { setCliSessionId } from "../../agents/cli-session.js";
import { hasNonzeroUsage, type NormalizedUsage } from "../../agents/usage.js";
import {
  type SessionSystemPromptReport,
  type SessionEntry,
  updateSessionStoreEntry,
} from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";

export async function persistSessionUsageUpdate(params: {
  storePath?: string;
  sessionKey?: string;
  usage?: NormalizedUsage;
  modelUsed?: string;
  providerUsed?: string;
  contextTokensUsed?: number;
  systemPromptReport?: SessionSystemPromptReport;
  cliSessionId?: string;
  logLabel?: string;
}): Promise<void> {
  const { storePath, sessionKey } = params;
  if (!storePath || !sessionKey) {
    return;
  }

  const label = params.logLabel ? `${params.logLabel} ` : "";
  if (hasNonzeroUsage(params.usage)) {
    try {
      await updateSessionStoreEntry({
        storePath,
        sessionKey,
        update: async (entry) => {
          const input = params.usage?.input ?? 0;
          const output = params.usage?.output ?? 0;
          const cacheRead = params.usage?.cacheRead ?? 0;
          const cacheWrite = params.usage?.cacheWrite ?? 0;
          const promptTokens = input + cacheRead + cacheWrite;
          const totalForTurn = promptTokens > 0 ? promptTokens : (params.usage?.total ?? input);
          const patch: Partial<SessionEntry> = {
            // Current turn (overwritten)
            inputTokens: input,
            outputTokens: output,
            totalTokens: totalForTurn,
            cacheReadTokens: cacheRead,
            cacheWriteTokens: cacheWrite,
            // Session cumulative (accumulated since last reset)
            sessionInputTokens: (entry.sessionInputTokens ?? 0) + input,
            sessionOutputTokens: (entry.sessionOutputTokens ?? 0) + output,
            sessionTotalTokens: (entry.sessionTotalTokens ?? 0) + totalForTurn,
            sessionCacheReadTokens: (entry.sessionCacheReadTokens ?? 0) + cacheRead,
            sessionCacheWriteTokens: (entry.sessionCacheWriteTokens ?? 0) + cacheWrite,
            // Lifetime cumulative (never reset)
            lifetimeInputTokens: (entry.lifetimeInputTokens ?? 0) + input,
            lifetimeOutputTokens: (entry.lifetimeOutputTokens ?? 0) + output,
            lifetimeTotalTokens: (entry.lifetimeTotalTokens ?? 0) + totalForTurn,
            lifetimeCacheReadTokens: (entry.lifetimeCacheReadTokens ?? 0) + cacheRead,
            lifetimeCacheWriteTokens: (entry.lifetimeCacheWriteTokens ?? 0) + cacheWrite,
            modelProvider: params.providerUsed ?? entry.modelProvider,
            model: params.modelUsed ?? entry.model,
            contextTokens: params.contextTokensUsed ?? entry.contextTokens,
            systemPromptReport: params.systemPromptReport ?? entry.systemPromptReport,
            updatedAt: Date.now(),
          };
          const cliProvider = params.providerUsed ?? entry.modelProvider;
          if (params.cliSessionId && cliProvider) {
            const nextEntry = { ...entry, ...patch };
            setCliSessionId(nextEntry, cliProvider, params.cliSessionId);
            return {
              ...patch,
              cliSessionIds: nextEntry.cliSessionIds,
              claudeCliSessionId: nextEntry.claudeCliSessionId,
            };
          }
          return patch;
        },
      });
    } catch (err) {
      logVerbose(`failed to persist ${label}usage update: ${String(err)}`);
    }
    return;
  }

  if (params.modelUsed || params.contextTokensUsed) {
    try {
      await updateSessionStoreEntry({
        storePath,
        sessionKey,
        update: async (entry) => {
          const patch: Partial<SessionEntry> = {
            modelProvider: params.providerUsed ?? entry.modelProvider,
            model: params.modelUsed ?? entry.model,
            contextTokens: params.contextTokensUsed ?? entry.contextTokens,
            systemPromptReport: params.systemPromptReport ?? entry.systemPromptReport,
            updatedAt: Date.now(),
          };
          const cliProvider = params.providerUsed ?? entry.modelProvider;
          if (params.cliSessionId && cliProvider) {
            const nextEntry = { ...entry, ...patch };
            setCliSessionId(nextEntry, cliProvider, params.cliSessionId);
            return {
              ...patch,
              cliSessionIds: nextEntry.cliSessionIds,
              claudeCliSessionId: nextEntry.claudeCliSessionId,
            };
          }
          return patch;
        },
      });
    } catch (err) {
      logVerbose(`failed to persist ${label}model/context update: ${String(err)}`);
    }
  }
}

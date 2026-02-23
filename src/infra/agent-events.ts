import type { VerboseLevel } from "../auto-reply/thinking.js";

export type AgentEventStream = "lifecycle" | "tool" | "assistant" | "error" | (string & {});

export type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: AgentEventStream;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

export type AgentRunContext = {
  sessionKey?: string;
  verboseLevel?: VerboseLevel;
  isHeartbeat?: boolean;
};

// Use globalThis to ensure singleton state survives bundler code-splitting.
// Without this, tsdown/rolldown may duplicate these Maps/Sets across chunks,
// causing listeners registered in one chunk to be invisible to emitters in another.
// See: https://github.com/openclaw/openclaw/issues/14406
const GLOBAL_KEY_SEQ = "__openclaw_agent_event_seqByRun";
const GLOBAL_KEY_LISTENERS = "__openclaw_agent_event_listeners";
const GLOBAL_KEY_CONTEXT = "__openclaw_agent_event_runContext";

const seqByRun: Map<string, number> =
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_SEQ] as Map<string, number>) ??
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_SEQ] = new Map<string, number>());

const listeners: Set<(evt: AgentEventPayload) => void> =
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_LISTENERS] as Set<
    (evt: AgentEventPayload) => void
  >) ??
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_LISTENERS] = new Set<
    (evt: AgentEventPayload) => void
  >());

const runContextById: Map<string, AgentRunContext> =
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_CONTEXT] as Map<string, AgentRunContext>) ??
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY_CONTEXT] = new Map<
    string,
    AgentRunContext
  >());

export function registerAgentRunContext(runId: string, context: AgentRunContext) {
  if (!runId) {
    return;
  }
  const existing = runContextById.get(runId);
  if (!existing) {
    runContextById.set(runId, { ...context });
    return;
  }
  if (context.sessionKey && existing.sessionKey !== context.sessionKey) {
    existing.sessionKey = context.sessionKey;
  }
  if (context.verboseLevel && existing.verboseLevel !== context.verboseLevel) {
    existing.verboseLevel = context.verboseLevel;
  }
  if (context.isHeartbeat !== undefined && existing.isHeartbeat !== context.isHeartbeat) {
    existing.isHeartbeat = context.isHeartbeat;
  }
}

export function getAgentRunContext(runId: string) {
  return runContextById.get(runId);
}

export function clearAgentRunContext(runId: string) {
  runContextById.delete(runId);
}

export function resetAgentRunContextForTest() {
  runContextById.clear();
}

export function emitAgentEvent(event: Omit<AgentEventPayload, "seq" | "ts">) {
  const nextSeq = (seqByRun.get(event.runId) ?? 0) + 1;
  seqByRun.set(event.runId, nextSeq);
  const context = runContextById.get(event.runId);
  const sessionKey =
    typeof event.sessionKey === "string" && event.sessionKey.trim()
      ? event.sessionKey
      : context?.sessionKey;
  const enriched: AgentEventPayload = {
    ...event,
    sessionKey,
    seq: nextSeq,
    ts: Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

export function onAgentEvent(listener: (evt: AgentEventPayload) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

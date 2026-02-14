/**
 * Injects `runId` and `runSeq` into every message appended to a session transcript.
 *
 * This enables tracking which messages belong to which run, useful for:
 * - Correlating streaming chat events with persisted messages
 * - Debugging WebChat stability issues
 * - Implementing paging/history features in clients
 *
 * Usage:
 *   const injector = installRunIdInjector(sessionManager, { runId });
 *   // ... do work ...
 *   injector.restore(); // optional: restore original appendMessage
 */
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";

export interface RunIdInjectorResult {
  /** Restore the original appendMessage method */
  restore: () => void;
  /** Get the current sequence number (number of messages appended) */
  getSeq: () => number;
}

export function installRunIdInjector(
  sessionManager: SessionManager,
  opts: {
    runId: string;
  },
): RunIdInjectorResult {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  let seq = 0;

  const injectedAppend = (message: AgentMessage) => {
    // Inject runId and runSeq into the message object
    const enrichedMessage = {
      ...message,
      runId: opts.runId,
      runSeq: seq++,
    };
    return originalAppend(enrichedMessage as AgentMessage);
  };

  // Monkey-patch appendMessage
  sessionManager.appendMessage = injectedAppend as SessionManager["appendMessage"];

  return {
    restore: () => {
      sessionManager.appendMessage = originalAppend as SessionManager["appendMessage"];
    },
    getSeq: () => seq,
  };
}

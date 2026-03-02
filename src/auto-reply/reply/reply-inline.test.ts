import { describe, expect, it } from "vitest";
import { stripInlineStatus } from "./reply-inline.js";

describe("stripInlineStatus", () => {
  it("preserves newlines when no /status directive exists", () => {
    const input = "line1\nline2\nline3";
    const out = stripInlineStatus(input);
    expect(out.cleaned).toBe("line1\nline2\nline3");
    expect(out.didStrip).toBe(false);
  });

  it("preserves newlines after removing /status", () => {
    const input = "line1\n/status\nline3";
    const out = stripInlineStatus(input);
    expect(out.cleaned).toBe("line1\nline3");
    expect(out.didStrip).toBe(true);
  });
});

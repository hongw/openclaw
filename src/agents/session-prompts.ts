import fs from "node:fs/promises";
import path from "node:path";

/**
 * Convert session key to a safe filename that prevents path traversal.
 * Simply replaces special characters with underscores.
 */
function sessionKeyToSafeFilename(sessionKey: string): string {
  // Replace all non-alphanumeric characters (except hyphen) with underscore
  // This prevents path traversal and ensures cross-platform compatibility
  return sessionKey.replace(/[^a-zA-Z0-9-]/g, "_") + ".md";
}

/**
 * Load session-specific prompt file from workspace/prompts/{sessionKey}.md
 * 
 * Example:
 *   sessionKey: "agent:main:soyserver-deploy"
 *   file: ~/.openclaw/workspace/prompts/agent_main_soyserver-deploy.md
 * 
 * The content is injected into extraSystemPrompt automatically.
 */
export async function loadSessionPromptFile(params: {
  sessionKey: string;
  workspaceDir: string;
}): Promise<string | undefined> {
  const promptsDir = path.join(params.workspaceDir, "prompts");
  
  // Convert session key to safe filename to prevent path traversal
  const filename = sessionKeyToSafeFilename(params.sessionKey);
  const filePath = path.join(promptsDir, filename);
  
  // Enforce containment: ensure resolved path is within prompts directory
  const resolved = path.resolve(filePath);
  const allowedBase = path.resolve(promptsDir) + path.sep;
  if (!resolved.startsWith(allowedBase)) {
    return undefined; // Path escaped prompts directory
  }
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const trimmed = content.trim();
    return trimmed || undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Only ignore "file not found" - other errors might indicate real problems
    if (code !== "ENOENT" && code !== "EISDIR") {
      console.warn(`Failed to load session prompt for ${params.sessionKey}:`, err);
    }
    return undefined;
  }
}

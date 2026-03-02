const INLINE_SIMPLE_COMMAND_ALIASES = new Map<string, string>([
  ["/help", "/help"],
  ["/commands", "/commands"],
  ["/whoami", "/whoami"],
  ["/id", "/whoami"],
]);
const INLINE_SIMPLE_COMMAND_RE = /(?:^|\s)\/(help|commands|whoami|id)(?=$|\s|:)/i;

const INLINE_STATUS_RE = /(?:^|\s)\/status(?=$|\s|:)(?:\s*:\s*)?/gi;

function normalizeDirectiveCleanedText(input: string): string {
  return input
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function extractInlineSimpleCommand(body?: string): {
  command: string;
  cleaned: string;
} | null {
  if (!body) {
    return null;
  }
  const match = body.match(INLINE_SIMPLE_COMMAND_RE);
  if (!match || match.index === undefined) {
    return null;
  }
  const alias = `/${match[1].toLowerCase()}`;
  const command = INLINE_SIMPLE_COMMAND_ALIASES.get(alias);
  if (!command) {
    return null;
  }
  const cleaned = normalizeDirectiveCleanedText(body.replace(match[0], " "));
  return { command, cleaned };
}

export function stripInlineStatus(body: string): {
  cleaned: string;
  didStrip: boolean;
} {
  const trimmed = body.trim();
  if (!trimmed) {
    return { cleaned: "", didStrip: false };
  }
  const cleaned = normalizeDirectiveCleanedText(trimmed.replace(INLINE_STATUS_RE, " "));
  return { cleaned, didStrip: cleaned !== trimmed };
}

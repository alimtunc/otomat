import { asString } from "#runtime/cli/frame-guards";
import type { ProviderLimitReport } from "#runtime/cli/turn";

/** Claude Code names an exhausted plan window in the `result` text of its final frame, and appends the unix second the window reopens. */
const USAGE_LIMIT_WITH_RESET = /usage limit reached\|(\d{9,})/i;

const LIMIT_PHRASES = [
  "usage limit reached",
  "rate limit",
  "rate_limit",
  "too many requests",
  "quota",
];

function reportedReset(text: string): string | null {
  const match = USAGE_LIMIT_WITH_RESET.exec(text);
  if (match?.[1] === undefined) return null;
  return new Date(Number(match[1]) * 1000).toISOString();
}

/**
 * The quota behind a failed `claude -p` turn, or null when the failure is the
 * model's own. Read from the result frame the CLI ends every turn with: its
 * subtype when the CLI names the limit there, its result text otherwise.
 */
export function claudeProviderLimit(frame: Record<string, unknown>): ProviderLimitReport | null {
  const result = asString(frame["result"]) ?? "";
  const subtype = asString(frame["subtype"]) ?? "";
  const haystack = `${subtype}\n${result}`.toLowerCase();
  if (!LIMIT_PHRASES.some((phrase) => haystack.includes(phrase))) return null;
  return { reason: result === "" ? subtype : result, resume_at: reportedReset(result) };
}

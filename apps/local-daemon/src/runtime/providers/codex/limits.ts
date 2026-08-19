import type { ProviderLimitReport } from "#runtime/cli/turn";

/** Codex reports an exhausted quota as an ordinary turn error and never publishes when it reopens, so `resume_at` is always null here. */
const LIMIT_PHRASES = [
  "usage limit",
  "rate limit",
  "rate_limit",
  "too many requests",
  "quota",
  "insufficient_quota",
];

export function codexProviderLimit(message: string): ProviderLimitReport | null {
  const haystack = message.toLowerCase();
  if (!LIMIT_PHRASES.some((phrase) => haystack.includes(phrase))) return null;
  return { reason: message, resume_at: null };
}

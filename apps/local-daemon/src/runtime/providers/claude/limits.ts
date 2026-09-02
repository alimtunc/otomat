import { asArray, asString } from "#runtime/cli/frame-guards";
import type { ProviderLimitReport } from "#runtime/cli/turn";

/** Claude Code composes its refusal per window kind, so recognition matches the shape rather than every `<kind> limit` the CLI can name. */
const LIMIT_PATTERNS = [
  /\b(?:usage|rate)[ _]limit/i,
  /\bhit your\b.{0,40}\blimit\b/i,
  /\blimit reached\b/i,
  /\btoo many requests\b/i,
  /quota(?![a-z])/i,
];

const RESET_EPOCH = /limit reached\|(\d{9,})/i;

/** A window more than a day out is printed as a date instead, which stays unresolved rather than guessing a calendar. */
const RESET_CLOCK = /resets\s+(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*([ap])m\b\s*(?:\(([^)]+)\))?/i;

const UTC_ZONE = /^(?:utc|gmt|etc\/(?:utc|gmt))$/i;

/** The CLI names the zone it ran in; any other zone is one this process has no offset for, and an unresolved reset beats a guessed one. */
function nextOccurrence(
  hour12: number,
  minute: number,
  meridiem: string,
  zone: string | null,
): Date | null {
  if (hour12 < 1 || hour12 > 12) return null;
  const utc = zone !== null && UTC_ZONE.test(zone);
  if (!utc && zone !== null && zone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
    return null;
  }
  const now = new Date();
  const at = new Date(now);
  const hour = (hour12 % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
  // The CLI truncates the reset to the minute it names, so the window is only certainly open at that minute's end.
  if (utc) at.setUTCHours(hour, minute, 59, 999);
  else at.setHours(hour, minute, 59, 999);
  if (at > now) return at;
  if (utc) at.setUTCDate(at.getUTCDate() + 1);
  else at.setDate(at.getDate() + 1);
  return at;
}

function reportedReset(text: string): string | null {
  const epoch = RESET_EPOCH.exec(text);
  if (epoch?.[1] !== undefined) {
    const reopens = new Date(Number(epoch[1]) * 1000);
    return Number.isNaN(reopens.getTime()) ? null : reopens.toISOString();
  }
  const clock = RESET_CLOCK.exec(text);
  if (clock?.[1] === undefined || clock[3] === undefined) return null;
  const at = nextOccurrence(Number(clock[1]), Number(clock[2] ?? "0"), clock[3], clock[4] ?? null);
  return at === null ? null : at.toISOString();
}

export function claudeProviderLimit(frame: Record<string, unknown>): ProviderLimitReport | null {
  const subtype = asString(frame["subtype"]) ?? "";
  // A failed turn carries its message in `errors`; only the result frame's success variant has `result`.
  const reported = asString(frame["result"]) || asArray(frame["errors"]).join("; ");
  if (!LIMIT_PATTERNS.some((pattern) => pattern.test(`${subtype}\n${reported}`))) return null;
  return { reason: reported === "" ? subtype : reported, resume_at: reportedReset(reported) };
}

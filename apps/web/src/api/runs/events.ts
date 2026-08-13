import type { EventEnvelope } from "@otomat/domain";

/**
 * Idempotent by seq: a re-delivered seq returns `current` unchanged (same reference), so the
 * `setEvents` updater bails out of a re-render. Out-of-order arrivals are inserted and the list
 * re-sorted ascending; the common ascending-arrival path is a plain tail append.
 */
export function mergeEvent(current: EventEnvelope[], event: EventEnvelope): EventEnvelope[] {
  const last = current.at(-1);
  if (last === undefined || event.seq > last.seq) return [...current, event];
  if (current.some((existing) => existing.seq === event.seq)) return current;
  const next = [...current, event];
  next.sort((a, b) => a.seq - b.seq);
  return next;
}

/** A live event at or below the newest loaded `seq` is a replay of a page the reader already has; drop it. */
export function mergeEventWindow(
  history: readonly EventEnvelope[],
  live: readonly EventEnvelope[],
): EventEnvelope[] {
  const tailSeq = history.at(-1)?.seq;
  if (tailSeq === undefined) return [...live];
  return [...history, ...live.filter((event) => event.seq > tailSeq)];
}

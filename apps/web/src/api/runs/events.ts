import type { EventEnvelope } from "@otomat/domain";

/** A re-delivered seq returns `current` unchanged, so the `setEvents` updater bails out of a re-render. */
export function mergeEvent(current: EventEnvelope[], event: EventEnvelope): EventEnvelope[] {
  const last = current.at(-1);
  if (last === undefined || event.seq > last.seq) return [...current, event];
  if (current.some((existing) => existing.seq === event.seq)) return current;
  const next = [...current, event];
  next.sort((a, b) => a.seq - b.seq);
  return next;
}

export function mergeEventWindow(
  history: readonly EventEnvelope[],
  live: readonly EventEnvelope[],
): EventEnvelope[] {
  const tailSeq = history.at(-1)?.seq;
  if (tailSeq === undefined) return [...live];
  return [...history, ...live.filter((event) => event.seq > tailSeq)];
}

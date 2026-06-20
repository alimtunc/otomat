import type { EventEnvelope } from "@otomat/domain";

export function mergeEvent(current: EventEnvelope[], event: EventEnvelope): EventEnvelope[] {
  if (current.some((existing) => existing.seq === event.seq)) return current;
  return [...current, event];
}

export function mergeEventsBySeq(
  persisted: EventEnvelope[],
  live: EventEnvelope[],
): EventEnvelope[] {
  const bySeq = new Map<number, EventEnvelope>();
  for (const event of persisted) bySeq.set(event.seq, event);
  for (const event of live) bySeq.set(event.seq, event);
  return [...bySeq.values()].toSorted((a, b) => a.seq - b.seq);
}

export function eventSummary(event: EventEnvelope): string {
  const payload = event.payload;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.tool === "string") return `tool · ${payload.tool}`;
  if (typeof payload.action === "string") return `permission · ${payload.action}`;
  if (typeof payload.decision === "string") return `decision · ${payload.decision}`;
  if (typeof payload.provider_session_id === "string") {
    return `session · ${payload.provider_session_id}`;
  }
  return event.type;
}

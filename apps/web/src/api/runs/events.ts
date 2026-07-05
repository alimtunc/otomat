import type { EventEnvelope } from "@otomat/domain";

// Events arrive in ascending seq (catch-up then live), so the common path is an O(1) tail append.
export function mergeEvent(current: EventEnvelope[], event: EventEnvelope): EventEnvelope[] {
  const last = current.at(-1);
  if (last === undefined || event.seq > last.seq) return [...current, event];
  if (current.some((existing) => existing.seq === event.seq)) return current;
  const next = [...current, event];
  next.sort((a, b) => a.seq - b.seq);
  return next;
}

/** One-line human summary: the first present payload field by priority (text, tool, action, decision, provider session id), else the raw event type. */
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

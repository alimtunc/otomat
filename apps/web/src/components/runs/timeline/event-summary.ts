import type { EventEnvelope } from "@otomat/domain";

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

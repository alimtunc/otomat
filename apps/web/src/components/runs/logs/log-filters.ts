import type { EventEnvelope, EventType } from "@otomat/domain";

/** Log buckets: runtime families map onto themselves; everything else is control-plane. */
export type LogCategory = "provider" | "tool" | "permission" | "usage" | "control";

export type LogFilter = "all" | LogCategory | "error";

const CATEGORY_BY_TYPE: Record<EventType, LogCategory> = {
  "run.lifecycle": "control",
  "step.lifecycle": "control",
  "session.lifecycle": "control",
  "compete.lifecycle": "control",
  "runtime.log": "provider",
  "runtime.message": "provider",
  "runtime.tool_call": "tool",
  "runtime.permission_request": "permission",
  "runtime.permission_response": "permission",
  "runtime.usage": "usage",
  "runtime.provider_session": "provider",
  "git.diff_updated": "control",
  "review.comment_created": "control",
  "review.comment_resolved": "control",
  "pr.created": "control",
  "pr.updated": "control",
  "system.reconciled": "control",
};

export function logCategory(event: EventEnvelope): LogCategory {
  return CATEGORY_BY_TYPE[event.type];
}

/** Errors cut across categories: failed tool calls and lifecycle events that settle on `failed`. */
export function isErrorLogEvent(event: EventEnvelope): boolean {
  if (event.payload["is_error"] === true) return true;
  return event.payload["final_status"] === "failed";
}

export function matchesLogFilter(event: EventEnvelope, filter: LogFilter): boolean {
  if (filter === "all") return true;
  if (filter === "error") return isErrorLogEvent(event);
  return logCategory(event) === filter;
}

export const LOG_FILTERS: readonly { value: LogFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "provider", label: "Provider" },
  { value: "tool", label: "Tools" },
  { value: "permission", label: "Permissions" },
  { value: "usage", label: "Usage" },
  { value: "error", label: "Errors" },
  { value: "control", label: "Control" },
];

export function countMatching(events: readonly EventEnvelope[], filter: LogFilter): number {
  return events.reduce((count, event) => count + (matchesLogFilter(event, filter) ? 1 : 0), 0);
}

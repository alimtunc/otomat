import {
  PERMISSION_MODE_STATUSES,
  type EventEnvelope,
  type PermissionModeStatus,
} from "@otomat/domain";
import { asString } from "@web/lib/coerce";

export interface PermissionDenial {
  id: string;
  tool: string;
  mode: string | null;
  /** Null when no request joined the refusal: nothing was read, so nothing can be diagnosed. */
  status: PermissionModeStatus | null;
  reason: string | null;
}

/** Claude reports the reason as the errored tool result and the refusal itself on the turn's final frame; `tool_use_id` is what joins them. */
function refusalReasons(events: readonly EventEnvelope[]): Map<string, string> {
  const reasons = new Map<string, string>();
  for (const event of events) {
    if (event.type !== "runtime.tool_call" || event.payload["is_error"] !== true) continue;
    const id = asString(event.payload["tool_use_id"]);
    const reason = asString(event.payload["result"]);
    if (id !== null && reason !== null) reasons.set(id, reason);
  }
  return reasons;
}

/** A request carrying no status cannot claim a mode was frozen, so it reads as the weakest of the four. */
function knownStatus(value: unknown): PermissionModeStatus {
  return PERMISSION_MODE_STATUSES.find((known) => known === value) ?? "unfrozen";
}

/** A refusal is the denied response, never the request alone: a runtime that asks and is granted refused nothing. */
export function permissionDenials(events: readonly EventEnvelope[]): PermissionDenial[] {
  const reasons = refusalReasons(events);
  const requests = new Map<string, EventEnvelope["payload"]>();
  const denials: PermissionDenial[] = [];
  for (const event of events) {
    const toolUseId = asString(event.payload["tool_use_id"]);
    if (event.type === "runtime.permission_request") {
      if (toolUseId !== null) requests.set(toolUseId, event.payload);
      continue;
    }
    if (event.type !== "runtime.permission_response") continue;
    if (event.payload["decision"] !== "denied") continue;
    const request = toolUseId === null ? undefined : requests.get(toolUseId);
    const payload = request ?? {};
    denials.push({
      id: event.id,
      tool: asString(payload["tool"]) ?? "an unnamed tool",
      mode: asString(payload["permission_mode"]),
      status: request === undefined ? null : knownStatus(payload["permission_mode_status"]),
      reason: toolUseId === null ? null : (reasons.get(toolUseId) ?? null),
    });
  }
  return denials;
}

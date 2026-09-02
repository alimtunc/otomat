import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import { workflowPresetErrorSchema } from "@otomat/domain";
import { activeHostLabel } from "@web/lib/active-host";

/** A typed refusal reads verbatim: the daemon's own sentence names what to fix. */
export function presetRefusalMessage(error: unknown, action: string): string {
  if (error instanceof DaemonRequestError) {
    const refusal = workflowPresetErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return `Could not ${action} — the daemon rejected the request.`;
  }
  if (error instanceof DaemonTransportError) {
    return `Could not ${action} — ${activeHostLabel()} did not answer, so nothing was changed on it and no other host was touched.`;
  }
  return `Could not ${action} — is the daemon running?`;
}

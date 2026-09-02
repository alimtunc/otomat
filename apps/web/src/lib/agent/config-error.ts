import { DaemonRequestError, DaemonTransportError } from "@otomat/client";
import { agentProfileErrorSchema } from "@otomat/domain";
import { activeHostLabel } from "@web/lib/active-host";

export function agentConfigRefusalMessage(error: unknown, subject: string): string {
  if (error instanceof DaemonRequestError) {
    const refusal = agentProfileErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return `Could not save ${subject} — the daemon rejected the request.`;
  }
  if (error instanceof DaemonTransportError) {
    return `Could not save ${subject} — ${activeHostLabel()} did not answer, so nothing was changed on it and no other host was touched.`;
  }
  return `Could not save ${subject} — is the daemon running?`;
}

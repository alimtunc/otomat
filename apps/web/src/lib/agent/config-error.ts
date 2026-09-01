import { DaemonRequestError } from "@otomat/client";
import { agentProfileErrorSchema } from "@otomat/domain";

export function agentConfigRefusalMessage(error: unknown, subject: string): string {
  if (error instanceof DaemonRequestError) {
    const refusal = agentProfileErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return `Could not save ${subject} — the daemon rejected the request.`;
  }
  return `Could not save ${subject} — is the daemon running?`;
}

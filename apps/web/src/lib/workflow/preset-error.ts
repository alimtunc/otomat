import { DaemonRequestError } from "@otomat/client";
import { workflowPresetErrorSchema } from "@otomat/domain";

/** A typed refusal reads verbatim: the daemon's own sentence names what to fix. */
export function presetRefusalMessage(error: unknown, action: string): string {
  if (error instanceof DaemonRequestError) {
    const refusal = workflowPresetErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return `Could not ${action} — the daemon rejected the request.`;
  }
  return `Could not ${action} — is the daemon running?`;
}

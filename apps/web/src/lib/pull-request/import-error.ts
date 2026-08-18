import { DaemonRequestError } from "@otomat/client";
import { pullRequestImportErrorSchema } from "@otomat/domain";

/** A refused adoption always names the verification that failed; showing anything else hides what to fix. */
export function pullRequestImportRefusal(error: unknown): string | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = pullRequestImportErrorSchema.safeParse(error.body);
  return refusal.success ? refusal.data.message : null;
}

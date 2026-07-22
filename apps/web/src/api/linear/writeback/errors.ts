import { DaemonRequestError } from "@otomat/client";
import { linearWriteConflictSchema, type LinearWriteConflict } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { isSupersededLinearError, linearErrorMessage } from "@web/api/linear/mutations";

export function linearWriteConflict(error: unknown): LinearWriteConflict | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const parsed = linearWriteConflictSchema.safeParse(error.body);
  return parsed.success ? parsed.data : null;
}

export function reportUnlessHandled(error: unknown): void {
  if (isSupersededLinearError(error) || linearWriteConflict(error) !== null) return;
  toast.error(linearErrorMessage(error));
}

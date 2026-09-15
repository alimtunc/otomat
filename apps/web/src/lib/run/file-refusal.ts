import { DaemonRequestError } from "@otomat/client";
import { worktreeFileErrorSchema, type WorktreeFileError } from "@otomat/domain";

function parseRefusal(error: unknown): { error: WorktreeFileError; message: string } | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = worktreeFileErrorSchema.safeParse(error.body);
  return refusal.success ? refusal.data : null;
}

export function worktreeFileRefusal(error: unknown): WorktreeFileError | null {
  return parseRefusal(error)?.error ?? null;
}

/** A typed refusal reads verbatim: the daemon's own sentence names what it could not read or write. */
export function worktreeFileMessage(error: unknown, fallback: string): string {
  return parseRefusal(error)?.message ?? fallback;
}

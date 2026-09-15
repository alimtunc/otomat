import { formatCommitSubject, type CommitType } from "@otomat/domain";
import type { AnyFieldMeta } from "@tanstack/react-form";

const isText = (error: unknown): error is string => typeof error === "string";

export function firstDraftError(
  fieldMeta: Record<string, AnyFieldMeta | undefined>,
  errors: readonly unknown[],
): string | undefined {
  return (
    Object.values(fieldMeta)
      .flatMap((meta) => meta?.errors ?? [])
      .find(isText) ?? errors.find(isText)
  );
}

export function subjectLength(values: {
  type: CommitType;
  scope: string;
  summary: string;
}): number {
  return formatCommitSubject({
    type: values.type,
    scope: values.scope.trim() || null,
    summary: values.summary,
  }).length;
}

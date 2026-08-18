import { z } from "zod";

/** The Conventional Commits vocabulary Otomat publishes with; a type outside it is refused, never rewritten. */
export const COMMIT_TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "test",
  "docs",
  "build",
  "ci",
  "chore",
  "revert",
] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];

export const COMMIT_SUBJECT_MAX_LENGTH = 72;

const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;

export interface CommitSubjectDraft {
  type: CommitType;
  scope: string | null;
  summary: string;
}

export function formatCommitSubject(subject: CommitSubjectDraft): string {
  const scope = subject.scope === null ? "" : `(${subject.scope})`;
  return `${subject.type}${scope}: ${subject.summary.trim()}`;
}

export function commitScopeViolation(scope: string): string | null {
  if (scope === "" || SCOPE_PATTERN.test(scope)) return null;
  return "A scope is lowercase, without spaces or parentheses.";
}

export function commitSummaryViolation(subject: CommitSubjectDraft): string | null {
  const summary = subject.summary.trim();
  if (summary === "") return "A summary is required.";
  if (summary.includes("\n")) return "A commit subject is a single line.";
  if (summary.endsWith(".")) return "A summary ends without a full stop.";
  const length = formatCommitSubject(subject).length;
  if (length > COMMIT_SUBJECT_MAX_LENGTH) {
    return `The subject reaches ${String(length)} characters; it stays within ${String(COMMIT_SUBJECT_MAX_LENGTH)}.`;
  }
  return null;
}

export function commitSubjectViolation(subject: CommitSubjectDraft): string | null {
  return commitScopeViolation(subject.scope ?? "") ?? commitSummaryViolation(subject);
}

/** The single validated object both the commit and the pull request title are composed from. */
export const commitSubjectSchema = z
  .object({
    type: z.enum(COMMIT_TYPES),
    scope: z.string().trim().min(1).nullable(),
    summary: z.string().trim().min(1),
  })
  .superRefine((subject, context) => {
    const violation = commitSubjectViolation(subject);
    if (violation !== null) context.addIssue({ code: "custom", message: violation });
  });
export type CommitSubject = z.infer<typeof commitSubjectSchema>;

const FORMATTED_SUBJECT = /^([a-z]+)(?:\(([^()]+)\))?: (.+)$/;

/** Reads back a subject Otomat itself composed; null for anything this contract would not have written. */
export function parseCommitSubject(formatted: string): CommitSubject | null {
  const match = FORMATTED_SUBJECT.exec(formatted.trim());
  if (match === null) return null;
  const [, type, scope, summary] = match;
  const parsed = commitSubjectSchema.safeParse({ type, scope: scope ?? null, summary });
  return parsed.success ? parsed.data : null;
}

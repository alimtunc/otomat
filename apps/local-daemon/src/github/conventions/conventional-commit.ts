import type { CommitConvention } from "@otomat/domain";

const CONVENTIONAL_SUBJECT = /^[a-z][a-z-]*(?:\([^()\n]+\))?!?: \S.*$/;

export const COMMIT_SUBJECT_MAX_LENGTH = 72;

export function isConventionalSubject(subject: string): boolean {
  return CONVENTIONAL_SUBJECT.test(subject);
}

/** Why this subject may not be committed here, in the operator's words, or null when it may. */
export function subjectViolation(convention: CommitConvention, subject: string): string | null {
  if (subject.includes("\n")) return "A commit subject is a single line.";
  if (subject.length > COMMIT_SUBJECT_MAX_LENGTH) {
    return `A commit subject stays within ${String(COMMIT_SUBJECT_MAX_LENGTH)} characters.`;
  }
  if (convention === "conventional" && !isConventionalSubject(subject)) {
    return `This repository writes Conventional Commits, so the subject must read "type(scope): summary"; "${subject}" does not.`;
  }
  return null;
}

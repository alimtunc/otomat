import type { CommitConvention } from "@otomat/domain";

import { recentSubjects } from "#git";

import { isConventionalSubject } from "./conventional-commit.js";

const CONVENTION_SAMPLE_SIZE = 40;

/** Below this, the history has not shown a habit yet, whatever the ratio says. */
const MINIMUM_EVIDENCE = 5;
const MAJORITY = 0.6;

export interface CommitConventionEvidence {
  convention: CommitConvention;
  /** The sampled subjects, newest first: what the detection read, and what a generator is shown. */
  subjects: string[];
}

/** Read from the repository's own commits — Otomat imposes no shape the history does not already carry. */
export function detectCommitConvention(repoPath: string, ref: string): CommitConventionEvidence {
  const subjects = recentSubjects(repoPath, ref, CONVENTION_SAMPLE_SIZE);
  if (subjects.length < MINIMUM_EVIDENCE) return { convention: "free_form", subjects };
  const conventional = subjects.filter(isConventionalSubject).length;
  return {
    convention: conventional >= subjects.length * MAJORITY ? "conventional" : "free_form",
    subjects,
  };
}

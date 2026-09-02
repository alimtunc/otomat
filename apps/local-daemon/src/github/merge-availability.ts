import type { PullRequestRow } from "@otomat/db";
import type { PullRequestMergeAvailability, PullRequestMergeBlocker } from "@otomat/domain";

import type { RepositoryMergePolicy } from "./cli/contract.js";

export interface MergeAvailabilityInput {
  /** Already mirrored from the same read `mergeState` comes from, so both describe one answer. */
  row: PullRequestRow;
  mergeState: string;
  policy: RepositoryMergePolicy;
  /** Login Otomat is signed in as; null leaves an unlinked pull request unauthorized. */
  viewerLogin: string | null;
}

interface StateRefusal {
  blocker: PullRequestMergeBlocker;
  reason: (row: PullRequestRow) => string;
}

/** An unproven branch is someone else's, which Otomat reviews and never moves. */
function authorized(row: PullRequestRow, viewerLogin: string | null): boolean {
  if (row.provenance === "otomat") return true;
  return row.author_login !== null && row.author_login === viewerLogin;
}

const CONFLICTING: StateRefusal = {
  blocker: "conflicting",
  reason: (row) => `${row.head_ref} conflicts with ${row.base_ref}; resolve the conflict first.`,
};

const MERGE_STATE_REFUSALS = new Map<string, StateRefusal>([
  ["DIRTY", CONFLICTING],
  [
    "BEHIND",
    {
      blocker: "behind_base",
      reason: (row) => `${row.head_ref} is behind ${row.base_ref}; update it before merging.`,
    },
  ],
  [
    "BLOCKED",
    {
      blocker: "blocked",
      reason: () => "GitHub blocks this merge: a required review or check has not passed.",
    },
  ],
  [
    "UNKNOWN",
    {
      blocker: "unknown",
      reason: () => "GitHub is still computing whether this pull request can merge.",
    },
  ],
]);

function refuse(blocker: PullRequestMergeBlocker, reason: string): PullRequestMergeAvailability {
  return { methods: [], blocker, reason };
}

function stateRefusal(row: PullRequestRow, mergeState: string): StateRefusal | null {
  if (row.mergeable === "conflicting") return CONFLICTING;
  if (row.checks_state === "pending") {
    return {
      blocker: "checks_pending",
      reason: () => "Checks are still running on this pull request.",
    };
  }
  return MERGE_STATE_REFUSALS.get(mergeState) ?? null;
}

/** Every refusal names its own reason, so an absent Merge button is always explained. */
export function mergeAvailability(input: MergeAvailabilityInput): PullRequestMergeAvailability {
  const { row, policy, viewerLogin } = input;
  if (!authorized(row, viewerLogin)) {
    return refuse(
      "not_authorized",
      `Otomat does not own ${row.head_ref ?? "this branch"} and you did not open this pull request, so it stays review-only.`,
    );
  }
  if (!policy.canPush) {
    return refuse("no_permission", "GitHub does not grant this account permission to merge here.");
  }
  if (policy.methods.length === 0) {
    return refuse("no_method", "This repository allows neither a merge commit nor a squash merge.");
  }
  if (row.status !== "open") {
    const state = row.status === "draft" ? "still a draft" : row.status;
    return refuse("not_open", `Pull request #${row.number} is ${state}, so it cannot be merged.`);
  }
  const refusal = stateRefusal(row, input.mergeState);
  if (refusal !== null) return refuse(refusal.blocker, refusal.reason(row));
  return {
    methods: policy.methods,
    blocker: null,
    reason: `Pull request #${row.number} can be merged into ${row.base_ref}.`,
  };
}

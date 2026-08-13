import type { PullRequestSync } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export interface PullRequestSyncModel {
  stateLabel: string;
  tone: StatusTone;
  description: string;
  pushDisabled: boolean;
  /** The remote head a rewrite may be leased against; null wherever no rewrite is on offer. */
  forceExpectedSha: string | null;
}

function commitCount(count: number): string {
  return count === 1 ? "1 commit" : `${count} commits`;
}

function dirtyNote(sync: PullRequestSync): string {
  return sync.dirty
    ? " Uncommitted changes in the workspace stay local until the run commits them."
    : "";
}

function unavailable(): PullRequestSyncModel {
  return {
    stateLabel: "Comparison unavailable",
    tone: "neutral",
    description:
      "Otomat could not compare this workspace with the pull request branch. Refresh to try again; nothing was published in the meantime.",
    pushDisabled: true,
    forceExpectedSha: null,
  };
}

function inSync(sync: PullRequestSync): PullRequestSyncModel {
  return {
    stateLabel: sync.dirty ? "Uncommitted changes" : "Pull request up to date",
    tone: sync.dirty ? "warning" : "success",
    description: sync.dirty
      ? "Every commit is published. The workspace has uncommitted changes, which a push cannot publish — commit them in the run first."
      : "The pull request shows exactly the commits this workspace holds.",
    pushDisabled: true,
    forceExpectedSha: null,
  };
}

function ahead(sync: PullRequestSync): PullRequestSyncModel {
  return {
    stateLabel: `${commitCount(sync.ahead.length)} to push`,
    tone: "warning",
    description: `The pull request is missing ${commitCount(sync.ahead.length)} from this workspace.${dirtyNote(sync)}`,
    pushDisabled: sync.ahead.length === 0,
    forceExpectedSha: null,
  };
}

function diverged(sync: PullRequestSync): PullRequestSyncModel {
  return {
    stateLabel: "Remote branch diverged",
    tone: "danger",
    description: `The pull request branch has ${commitCount(sync.replaced.length)} this workspace does not. A normal push is refused; only a force push with lease can replace them.${dirtyNote(sync)}`,
    pushDisabled: true,
    forceExpectedSha: sync.remote_head_sha,
  };
}

export function pullRequestSyncModel(sync: PullRequestSync): PullRequestSyncModel {
  switch (sync.state) {
    case "unavailable":
      return unavailable();
    case "in_sync":
      return inSync(sync);
    case "ahead":
      return ahead(sync);
    case "diverged":
      return diverged(sync);
  }
}

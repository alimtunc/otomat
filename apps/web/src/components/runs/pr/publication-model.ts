import type { PullRequestContract, PullRequestPublicationMode } from "@otomat/domain";

export interface PublicationModel {
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
}

const UPDATE_LABEL = "Update PR details";

const PENDING_PUBLICATION_MODELS = {
  pushing: {
    actionLabel: "Pushing branch…",
    actionDisabled: true,
    actionPending: true,
    stateLabel: "Pushing",
  },
  creating: {
    actionLabel: "Creating pull request…",
    actionDisabled: true,
    actionPending: true,
    stateLabel: "Creating",
  },
} as const satisfies Record<"pushing" | "creating", PublicationModel>;

/** Details only: this action edits title, description and Draft/Ready, and never moves a commit. */
function createdModel(hasDraftChanges: boolean): PublicationModel {
  return {
    actionLabel: UPDATE_LABEL,
    actionDisabled: !hasDraftChanges,
    actionPending: false,
    stateLabel: hasDraftChanges ? "Unsaved details" : "Details published",
  };
}

/** The action says which of the two publications it will perform, so the choice is never implicit. */
function createLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR" : "Create PR ready for review";
}

function newModel(
  canPublish: boolean,
  connected: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  const stateLabel = canPublish && connected ? "Ready to publish" : "Run not ready for publication";
  return {
    actionLabel: createLabel(mode),
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: canPublish && !connected ? "Not configured" : stateLabel,
  };
}

function terminalModel(status: "merged" | "closed"): PublicationModel {
  return {
    actionLabel: "Pull request complete",
    actionDisabled: true,
    actionPending: false,
    stateLabel: `PR ${status}`,
  };
}

/** A pull request that exists stays editable whatever its run went on to do; only creation waits on the run. */
function failedModel(pullRequest: PullRequestContract, canPublish: boolean): PublicationModel {
  if (pullRequest.number !== null) {
    return {
      actionLabel: UPDATE_LABEL,
      actionDisabled: false,
      actionPending: false,
      stateLabel: "Update failed",
    };
  }
  return {
    actionLabel: "Retry PR",
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: "Creation failed",
  };
}

export function publicationModel(
  pullRequest: PullRequestContract | null,
  canPublish: boolean,
  connected: boolean,
  hasDraftChanges: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  if (pullRequest === null) return newModel(canPublish, connected, mode);
  if (pullRequest.status === "merged" || pullRequest.status === "closed") {
    return terminalModel(pullRequest.status);
  }
  if (pullRequest.publication_status === "pushing") return PENDING_PUBLICATION_MODELS.pushing;
  if (pullRequest.publication_status === "creating") return PENDING_PUBLICATION_MODELS.creating;
  if (pullRequest.publication_status === "created") return createdModel(hasDraftChanges);
  if (pullRequest.publication_status === "failed") return failedModel(pullRequest, canPublish);
  return {
    actionLabel: createLabel(mode),
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: "Not configured",
  };
}

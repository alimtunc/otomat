import type { PullRequestContract, PullRequestPublicationMode } from "@otomat/domain";

export interface PublicationModel {
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
}

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

function createdModel(
  pullRequest: PullRequestContract,
  hasDraftChanges: boolean,
): PublicationModel {
  if (hasDraftChanges || pullRequest.has_unpublished_changes === true) {
    return {
      actionLabel: "Update PR",
      actionDisabled: false,
      actionPending: false,
      stateLabel: "Unpublished changes",
    };
  }
  if (pullRequest.has_unpublished_changes === null) {
    return {
      actionLabel: "Retry comparison",
      actionDisabled: false,
      actionPending: false,
      stateLabel: "Changes unavailable",
    };
  }
  return {
    actionLabel: "Pull request up to date",
    actionDisabled: true,
    actionPending: false,
    stateLabel: "Up to date",
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

function failedModel(pullRequest: PullRequestContract, canPublish: boolean): PublicationModel {
  const isCreation = pullRequest.number === null;
  return {
    actionLabel: isCreation ? "Retry PR" : "Update PR",
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: pullRequest.number === null ? "Creation failed" : "Update failed",
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
  if (pullRequest.publication_status === "created") {
    return createdModel(pullRequest, hasDraftChanges);
  }
  if (pullRequest.publication_status === "failed") return failedModel(pullRequest, canPublish);
  return {
    actionLabel: createLabel(mode),
    actionDisabled: !canPublish,
    actionPending: false,
    stateLabel: "Not configured",
  };
}

import type {
  PullRequestContract,
  PullRequestPublicationMode,
  PullRequestPublishability,
} from "@otomat/domain";

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
function createdModel(hasDraftChanges: boolean, connected: boolean): PublicationModel {
  return {
    actionLabel: UPDATE_LABEL,
    actionDisabled: !hasDraftChanges || !connected,
    actionPending: false,
    stateLabel: hasDraftChanges ? "Unsaved details" : "Details published",
  };
}

/** The action says which of the two publications it will perform, so the choice is never implicit. */
function createLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR" : "Create PR ready for review";
}

/** A workspace that cannot publish says exactly why; how the run ended is never the answer. */
function creationModel(
  publishability: PullRequestPublishability,
  connected: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  if (publishability.blocker !== null) {
    return {
      actionLabel: createLabel(mode),
      actionDisabled: true,
      actionPending: false,
      stateLabel: "Cannot publish",
    };
  }
  return {
    actionLabel: createLabel(mode),
    actionDisabled: !connected,
    actionPending: false,
    stateLabel: connected ? "Ready to publish" : "Not connected",
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

/** A pull request that exists stays editable whatever its run went on to do. */
function failedModel(
  pullRequest: PullRequestContract,
  publishability: PullRequestPublishability,
  connected: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  if (pullRequest.number !== null) {
    return {
      actionLabel: UPDATE_LABEL,
      actionDisabled: !connected,
      actionPending: false,
      stateLabel: "Update failed",
    };
  }
  return { ...creationModel(publishability, connected, mode), stateLabel: "Creation failed" };
}

export function publicationModel(
  pullRequest: PullRequestContract | null,
  publishability: PullRequestPublishability,
  connected: boolean,
  hasDraftChanges: boolean,
  mode: PullRequestPublicationMode,
): PublicationModel {
  if (pullRequest === null) return creationModel(publishability, connected, mode);
  if (pullRequest.status === "merged" || pullRequest.status === "closed") {
    return terminalModel(pullRequest.status);
  }
  if (pullRequest.publication_status === "pushing") return PENDING_PUBLICATION_MODELS.pushing;
  if (pullRequest.publication_status === "creating") return PENDING_PUBLICATION_MODELS.creating;
  if (pullRequest.publication_status === "created") {
    return createdModel(hasDraftChanges, connected);
  }
  if (pullRequest.publication_status === "failed") {
    return failedModel(pullRequest, publishability, connected, mode);
  }
  return creationModel(publishability, connected, mode);
}

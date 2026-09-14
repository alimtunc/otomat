import type {
  OperationContract,
  PullRequestContract,
  PullRequestPublicationMode,
  PullRequestPublishability,
} from "@otomat/domain";

export interface PublicationModel {
  actionLabel: string;
  actionDisabled: boolean;
  actionPending: boolean;
  stateLabel: string;
  status: "Not published" | "Publishing" | "Published";
}

type PublicationAction = Omit<PublicationModel, "status">;

export interface PublicationModelInput {
  pullRequest: PullRequestContract | null;
  operation: OperationContract | null;
  publishability: PullRequestPublishability;
  connected: boolean;
  hasDraftChanges: boolean;
  mode: PullRequestPublicationMode;
}

const UPDATE_LABEL = "Update PR details";
const RETRY_LABEL = "Retry publication";

export function isPublished(pullRequest: PullRequestContract | null): boolean {
  return pullRequest?.number != null;
}

function createdModel(hasDraftChanges: boolean, connected: boolean): PublicationAction {
  return {
    actionLabel: UPDATE_LABEL,
    actionDisabled: !hasDraftChanges || !connected,
    actionPending: false,
    stateLabel: hasDraftChanges ? "Unsaved details" : "Details published",
  };
}

export function generationBlocked(publishability: PullRequestPublishability): boolean {
  return (
    publishability.blocker?.code === "worktree_missing" ||
    publishability.blocker?.code === "remote_missing" ||
    publishability.changed_files === 0
  );
}

function createLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR" : "Create PR ready for review";
}

function creationModel(input: PublicationModelInput): PublicationAction {
  const { publishability, connected, mode } = input;
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

function runningModel(operation: OperationContract): PublicationAction {
  const label = operation.phases.find((phase) => phase.state === "active")?.label ?? "Publishing";
  return {
    actionLabel: `${label}…`,
    actionDisabled: true,
    actionPending: true,
    stateLabel: label,
  };
}

function stoppedModel(
  input: PublicationModelInput,
  pullRequest: PullRequestContract,
  interrupted: boolean,
): PublicationAction {
  if (isPublished(pullRequest)) {
    return {
      actionLabel: interrupted ? RETRY_LABEL : UPDATE_LABEL,
      actionDisabled: !input.connected,
      actionPending: false,
      stateLabel: interrupted ? "Publication interrupted" : "Update failed",
    };
  }
  return {
    ...creationModel(input),
    actionLabel: interrupted ? RETRY_LABEL : createLabel(input.mode),
    stateLabel: interrupted ? "Publication interrupted" : "Creation failed",
  };
}

function publicationAction(input: PublicationModelInput): PublicationAction {
  const { pullRequest, operation } = input;
  if (pullRequest === null || operation === null) return creationModel(input);
  if (operation.state === "running") return runningModel(operation);
  if (operation.state === "succeeded") return createdModel(input.hasDraftChanges, input.connected);
  return stoppedModel(input, pullRequest, operation.state === "interrupted");
}

/** The operation is the only account of the publication: reading `publication_status` beside it is how the two disagree. A terminal pull request never reaches this model — the PR tab renders its outcome view instead. */
export function publicationModel(input: PublicationModelInput): PublicationModel {
  const action = publicationAction(input);
  let status: PublicationModel["status"] = isPublished(input.pullRequest)
    ? "Published"
    : "Not published";
  if (action.actionPending) status = "Publishing";
  return { ...action, status };
}

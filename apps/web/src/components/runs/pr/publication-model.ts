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
}

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

function createdModel(hasDraftChanges: boolean, connected: boolean): PublicationModel {
  return {
    actionLabel: UPDATE_LABEL,
    actionDisabled: !hasDraftChanges || !connected,
    actionPending: false,
    stateLabel: hasDraftChanges ? "Unsaved details" : "Details published",
  };
}

function createLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR" : "Create PR ready for review";
}

function creationModel(input: PublicationModelInput): PublicationModel {
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

function runningModel(operation: OperationContract): PublicationModel {
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
): PublicationModel {
  if (pullRequest.number !== null) {
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

/** The operation is the only account of the publication: reading `publication_status` beside it is how the two disagree. A terminal pull request never reaches this model — the PR tab renders its outcome view instead. */
export function publicationModel(input: PublicationModelInput): PublicationModel {
  const { pullRequest, operation } = input;
  if (pullRequest === null || operation === null) return creationModel(input);
  if (operation.state === "running") return runningModel(operation);
  if (operation.state === "succeeded") return createdModel(input.hasDraftChanges, input.connected);
  return stoppedModel(input, pullRequest, operation.state === "interrupted");
}

import type { PullRequestDetail, PullRequestState, RunDetail, RunState } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

type NextActionKind =
  | "answer"
  | "choose"
  | "follow"
  | "wait"
  | "review"
  | "publish"
  | "publishing"
  | "open_pr"
  | "open_failed_step"
  | "done"
  | "stopped";

type NextActionTarget =
  | { type: "conversation"; stepId?: string }
  | { type: "diff" }
  | { type: "pr" }
  | { type: "external"; url: string };

export interface NextActionCta {
  label: string;
  /** Chip-length copy for dense surfaces; `label` when absent. */
  shortLabel?: string;
  target: NextActionTarget;
}

/** The one thing the operator can usefully do next; `cta` is null when the state needs nothing from them. */
export interface NextAction {
  kind: NextActionKind;
  description: string;
  tone: StatusTone;
  cta: NextActionCta | null;
}

export interface NextActionPullRequest {
  status: PullRequestState;
  number: number | null;
  url: string | null;
  publishing: boolean;
}

export interface NextActionInput {
  status: RunState;
  /** `undefined` when publication state is unknown (the runs list); `null` when known absent. */
  pullRequest?: NextActionPullRequest | null;
  /** Latest failed step, when the caller has the run's step graph. */
  failedStepId?: string | null;
}

const FOLLOW_CTA: NextActionCta = { label: "Follow live", target: { type: "conversation" } };

const PUBLISH_ACTION: NextAction = {
  kind: "publish",
  description: "The run finished — its work is not published yet.",
  tone: "iris",
  cta: { label: "Publish the pull request", shortLabel: "Publish", target: { type: "pr" } },
};

function prName(pullRequest: NextActionPullRequest): string {
  return pullRequest.number === null ? "The pull request" : `PR #${String(pullRequest.number)}`;
}

function openPrCta(pullRequest: NextActionPullRequest): NextActionCta {
  if (pullRequest.url === null) return { label: "Open the PR tab", target: { type: "pr" } };
  return {
    label: `Open ${prName(pullRequest)}`,
    target: { type: "external", url: pullRequest.url },
  };
}

function completedAction(pullRequest: NextActionPullRequest | null | undefined): NextAction {
  if (pullRequest === undefined) {
    return { kind: "done", description: "Run completed.", tone: "success", cta: null };
  }
  if (pullRequest === null) return PUBLISH_ACTION;
  if (pullRequest.publishing) {
    return {
      kind: "publishing",
      description: "Publishing the pull request…",
      tone: "live",
      cta: { label: "Open the PR tab", target: { type: "pr" } },
    };
  }
  if (pullRequest.status === "merged") {
    return {
      kind: "done",
      description: `Run completed — ${prName(pullRequest)} is merged. Nothing left to do here.`,
      tone: "review",
      cta: null,
    };
  }
  if (pullRequest.status === "closed") {
    return {
      kind: "done",
      description: `Run completed — ${prName(pullRequest)} was closed without merging.`,
      tone: "neutral",
      cta: null,
    };
  }
  // A live row without a provider number is a proposal or a stopped publication, not a PR on GitHub.
  if (pullRequest.number === null) return PUBLISH_ACTION;
  return {
    kind: "open_pr",
    description:
      pullRequest.status === "draft"
        ? `${prName(pullRequest)} is a draft — mark it ready when it should be reviewed.`
        : `${prName(pullRequest)} is open — waiting on its review.`,
    tone: "success",
    cta: openPrCta(pullRequest),
  };
}

export function resolveNextAction(input: NextActionInput): NextAction {
  switch (input.status) {
    case "queued":
      return {
        kind: "follow",
        description: "Queued — waiting for a session slot.",
        tone: "neutral",
        cta: FOLLOW_CTA,
      };
    case "preparing":
      return {
        kind: "follow",
        description: "Preparing the workspace.",
        tone: "live",
        cta: FOLLOW_CTA,
      };
    case "running":
      return {
        kind: "follow",
        description: "The agent is working.",
        tone: "live",
        cta: FOLLOW_CTA,
      };
    case "awaiting_permission":
      return {
        kind: "answer",
        description: "The agent is blocked on a permission request.",
        tone: "warning",
        cta: {
          label: "Answer the request",
          shortLabel: "Answer",
          target: { type: "conversation" },
        },
      };
    case "awaiting_human":
      return {
        kind: "answer",
        description: "The agent asked a question and waits on your answer.",
        tone: "warning",
        cta: {
          label: "Answer in the conversation",
          shortLabel: "Answer",
          target: { type: "conversation" },
        },
      };
    case "awaiting_selection":
      return {
        kind: "choose",
        description: "Competing candidates finished — one must be chosen.",
        tone: "warning",
        cta: {
          label: "Choose the winner",
          shortLabel: "Choose winner",
          target: { type: "conversation" },
        },
      };
    case "waiting_for_provider":
      return {
        kind: "wait",
        description: "Waiting on the provider quota to reset.",
        tone: "warning",
        cta: null,
      };
    case "review_ready":
      return {
        kind: "review",
        description: "The run finished its work — the diff is ready for review.",
        tone: "review",
        cta: { label: "Review the diff", shortLabel: "Review diff", target: { type: "diff" } },
      };
    case "completed":
      return completedAction(input.pullRequest);
    case "failed":
      return {
        kind: "open_failed_step",
        description: "The run failed — its failing step says why.",
        tone: "danger",
        cta: {
          label: "Open the failing step",
          shortLabel: "Open step",
          target:
            input.failedStepId == null
              ? { type: "conversation" }
              : { type: "conversation", stepId: input.failedStepId },
        },
      };
    case "canceled":
      return { kind: "stopped", description: "This run was canceled.", tone: "neutral", cta: null };
  }
}

export function ctaTargetsCurrentTab(cta: NextActionCta, pathname: string, runId: string): boolean {
  switch (cta.target.type) {
    case "pr":
      return pathname === `/runs/${runId}/pr`;
    case "diff":
      return pathname === `/runs/${runId}/diff`;
    case "conversation":
      return cta.target.stepId === undefined && pathname === `/runs/${runId}`;
    case "external":
      return false;
  }
}

function pullRequestFacts(
  pullRequestDetail: PullRequestDetail | undefined,
): NextActionPullRequest | null | undefined {
  if (pullRequestDetail === undefined) return undefined;
  const { pull_request: pullRequest, operation } = pullRequestDetail;
  if (pullRequest === null) return null;
  return {
    status: pullRequest.status,
    number: pullRequest.number,
    url: pullRequest.url,
    publishing: operation?.state === "running",
  };
}

export function runNextAction(
  detail: RunDetail,
  pullRequestDetail: PullRequestDetail | undefined,
): NextAction {
  return resolveNextAction({
    status: detail.run.status,
    failedStepId: detail.steps.findLast((step) => step.status === "failed")?.id ?? null,
    pullRequest: pullRequestFacts(pullRequestDetail),
  });
}

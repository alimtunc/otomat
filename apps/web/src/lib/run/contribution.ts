import { DaemonRequestError } from "@otomat/client";
import {
  canFollowUpRun,
  isRunResumable,
  isRunSettled,
  projectRunContributionDelivery,
  resolveStepContributionRoute,
  type RunContributionContract,
  type RunDetail,
  type ResolvedAgentConfig,
  type RuntimeDescriptor,
  type StepContributionRoute,
  type StepRunContract,
} from "@otomat/domain";
import type { ConnectionState } from "@otomat/ui";
import { stepParticipant } from "@web/lib/run/participant";

export function contributionErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const body = error.body;
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
    return error.status >= 500
      ? "The daemon failed to record this message."
      : "The daemon rejected this request.";
  }
  return "Could not reach the daemon — is it running?";
}

/** Only what no turn has taken yet: a message already on its way to a live session is not waiting for one. */
export function queuedCount(contributions: readonly RunContributionContract[]): number {
  return contributions.reduce(
    (count, item) => count + (projectRunContributionDelivery(item) === "waiting" ? 1 : 0),
    0,
  );
}

export interface ContributionGate {
  stepRunId: string | null;
  stepName: string | null;
  /** Honest one-liner shown under the composer, whether or not sending is possible. */
  note: string;
  /** The message will be persisted and wait for a turn rather than start one now. */
  queues: boolean;
  targetAgentSessionId: string | null;
  targetConfig: ResolvedAgentConfig | null;
}

const RESTING_NOTE = "Resumes this step's agent session as a new turn.";
const STEERING_NOTE = "The agent is working — this message is delivered at its next safe turn.";
const LIVE_NOTE =
  "The agent is working — this message goes into its live session without waiting for the turn to end.";
const FIRST_TURN_NOTE = "This step has not started — this message is delivered in its first turn.";
const CAPACITY_NOTE =
  "This run is waiting for capacity — this message is delivered in its next turn.";
const PROVIDER_WAIT_NOTE =
  "This run is waiting on its provider quota — this message is delivered when it resumes.";

/** No turn is live yet while the run waits on the semaphore, so the composer must not claim the agent is working. */
function isWaitingForCapacity(status: RunDetail["run"]["status"]): boolean {
  return status === "queued" || status === "preparing";
}

function blocked(note: string): ContributionGate {
  return {
    stepRunId: null,
    stepName: null,
    note,
    queues: false,
    targetAgentSessionId: null,
    targetConfig: null,
  };
}

interface RoutedStep {
  step: StepRunContract;
  route: StepContributionRoute;
}

function isSteerable(detail: RunDetail, stepRunId: string): boolean {
  return detail.sessions.some(
    (session) => session.step_run_id === stepRunId && session.provider_session_id !== null,
  );
}

function isCompeteLoser(detail: RunDetail, step: StepRunContract): boolean {
  if (step.compete_group_id === null) return false;
  const group = detail.compete_groups.find((candidate) => candidate.id === step.compete_group_id);
  return group?.winner_step_run_id != null && group.winner_step_run_id !== step.id;
}

function selectedRoute(detail: RunDetail, stepRunId: string): RoutedStep | null {
  const step = detail.steps.find((candidate) => candidate.id === stepRunId);
  if (!step) return null;
  const route = resolveStepContributionRoute(step, detail.sessions, detail.compete_groups);
  return route === null ? null : { step, route };
}

/** Mirrors the daemon's own refusals, so the composer never offers an action the daemon would drop. */
export function resolveContributionGate(
  detail: RunDetail,
  descriptors: RuntimeDescriptor[] | undefined,
  connectionState: ConnectionState,
  selectedStepRunId: string,
): ContributionGate {
  if (connectionState !== "online") {
    return blocked("Daemon offline — reconnect to send a message.");
  }
  if (isRunSettled(detail.run.status)) {
    return blocked(
      isRunResumable(detail.run.status)
        ? "This run has stopped — resume it to continue the conversation."
        : "This run is finished — its session can no longer be resumed.",
    );
  }
  if (descriptors === undefined) {
    return blocked("Checking runtime availability…");
  }
  const target = selectedRoute(detail, selectedStepRunId);
  if (target === null) {
    const step = detail.steps.find((candidate) => candidate.id === selectedStepRunId);
    return blocked(
      step && isCompeteLoser(detail, step)
        ? "This competitor was not selected — its worktree is archived and no turn of it will run again."
        : "This step is finished and its participant cannot receive another message. Add a follow-up step with a user profile to continue.",
    );
  }

  const { session, config } = stepParticipant(detail, target.step.id);
  if (config === null) {
    return blocked("This step has no frozen participant configuration.");
  }
  const runtime = descriptors.find((descriptor) => descriptor.id === config.runtime);
  if (!runtime) {
    return blocked("This step's runtime is not registered on the daemon.");
  }
  if (runtime.availability.status !== "available") {
    return blocked(`${runtime.display_name} is not available on this machine.`);
  }
  if (target.route === "steering") {
    if (!runtime.capabilities.resume) {
      return blocked(`${runtime.display_name} does not support resuming a session.`);
    }
    if (runtime.capabilities.steering === "unsupported") {
      return blocked(`${runtime.display_name} cannot take a message once a session has started.`);
    }
  }

  const routed = {
    stepRunId: target.step.id,
    stepName: target.step.name,
    targetAgentSessionId: session?.id ?? null,
    targetConfig: config,
  };
  if (target.route === "first_turn") {
    return { ...routed, note: FIRST_TURN_NOTE, queues: true };
  }
  if (isWaitingForCapacity(detail.run.status)) {
    return { ...routed, note: CAPACITY_NOTE, queues: true };
  }
  if (detail.run.status === "waiting_for_provider") {
    return { ...routed, note: PROVIDER_WAIT_NOTE, queues: true };
  }
  if (!canFollowUpRun(detail.run.status)) {
    const live = runtime.capabilities.steering === "live";
    return { ...routed, note: live ? LIVE_NOTE : STEERING_NOTE, queues: !live };
  }
  // A resting run starts no turn on its own, so the daemon fails a message whose step has no session left to resume.
  if (!isSteerable(detail, target.step.id)) {
    return blocked("No provider session to resume yet.");
  }
  return { ...routed, note: RESTING_NOTE, queues: false };
}

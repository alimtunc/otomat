import {
  canFollowUpRun,
  executableSteps,
  isRunResumable,
  isRunSettled,
  resolveStepContributionRoute,
  type RunContributionContract,
  type RunDetail,
  type RuntimeDescriptor,
  type StepContributionRoute,
  type StepRunContract,
} from "@otomat/domain";
import type { ConnectionState } from "@otomat/ui";

export function queuedCount(contributions: readonly RunContributionContract[]): number {
  return contributions.reduce((count, item) => count + (item.status === "queued" ? 1 : 0), 0);
}

export interface ContributionGate {
  stepRunId: string | null;
  stepName: string | null;
  /** Honest one-liner shown under the composer, whether or not sending is possible. */
  note: string;
  /** The message will be persisted and wait for a turn rather than start one now. */
  queues: boolean;
}

const RESTING_NOTE = "Resumes this step's agent session as a new turn.";
const STEERING_NOTE = "The agent is working — this message is delivered at its next safe turn.";
const FIRST_TURN_NOTE = "This step has not started — this message is delivered in its first turn.";
const CAPACITY_NOTE =
  "This run is waiting for capacity — this message is delivered in its next turn.";

/** No turn is live yet while the run waits on the semaphore, so the composer must not claim the agent is working. */
function isWaitingForCapacity(status: RunDetail["run"]["status"]): boolean {
  return status === "queued" || status === "preparing";
}

function blocked(note: string): ContributionGate {
  return { stepRunId: null, stepName: null, note, queues: false };
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

/** The furthest step whose session can still be steered, or else the earliest one that has yet to run. */
function routeTarget(detail: RunDetail): RoutedStep | null {
  const eligible = detail.steps
    .toSorted((left, right) => left.idx - right.idx)
    .flatMap((step) => {
      const route = resolveStepContributionRoute(step, detail.sessions, detail.compete_groups);
      return route === null ? [] : [{ step, route }];
    });
  const steering = eligible.filter((entry) => entry.route === "steering");
  // Only a resting run may skip an unsteerable step: mid-turn the live session has no provider id yet, since settle writes it.
  const resumable = canFollowUpRun(detail.run.status)
    ? steering.findLast((entry) => isSteerable(detail, entry.step.id))
    : undefined;
  return resumable ?? steering.at(-1) ?? eligible.at(0) ?? null;
}

/** The runtime that would carry the message: the step's own session, or the agent its frozen plan node names. */
function runtimeForStep(
  detail: RunDetail,
  stepRunId: string,
  descriptors: RuntimeDescriptor[],
): RuntimeDescriptor | undefined {
  const session = detail.sessions.findLast((row) => row.step_run_id === stepRunId);
  const planned = executableSteps(detail.run.plan_json).find((step) => step.id === stepRunId);
  const agentId = session?.agent_id ?? planned?.agent;
  return descriptors.find((descriptor) => descriptor.id === agentId);
}

/** Mirrors the daemon's own refusals, so the composer never offers an action the daemon would drop. */
export function resolveContributionGate(
  detail: RunDetail,
  descriptors: RuntimeDescriptor[] | undefined,
  connectionState: ConnectionState,
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
  const target = routeTarget(detail);
  if (target === null) {
    return blocked("Every step of this run is finished — none of them will run another turn.");
  }

  const runtime = runtimeForStep(detail, target.step.id, descriptors);
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

  const routed = { stepRunId: target.step.id, stepName: target.step.name };
  if (target.route === "first_turn") {
    return { ...routed, note: FIRST_TURN_NOTE, queues: true };
  }
  if (isWaitingForCapacity(detail.run.status)) {
    return { ...routed, note: CAPACITY_NOTE, queues: true };
  }
  if (!canFollowUpRun(detail.run.status)) {
    return { ...routed, note: STEERING_NOTE, queues: true };
  }
  // A resting run starts no turn on its own, so the daemon fails a message whose step has no session left to resume.
  if (!isSteerable(detail, target.step.id)) {
    return blocked("No provider session to resume yet.");
  }
  return { ...routed, note: RESTING_NOTE, queues: false };
}

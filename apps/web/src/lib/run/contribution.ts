import {
  canFollowUpRun,
  isRunTerminal,
  selectLatestResumableSession,
  type AgentSessionContract,
  type RunContributionContract,
  type RunDetail,
  type RuntimeDescriptor,
} from "@otomat/domain";
import type { ConnectionState } from "@otomat/ui";

export function queuedCount(contributions: readonly RunContributionContract[]): number {
  return contributions.reduce((count, item) => count + (item.status === "queued" ? 1 : 0), 0);
}

export interface ContributionGate {
  enabled: boolean;
  /** Honest one-liner shown under the composer, whether or not sending is possible. */
  note: string;
  /** The message will be persisted and wait for the run's next safe turn rather than start one now. */
  queues: boolean;
}

const RESTING_NOTE = "Resumes the same agent session as a new turn on this run.";
const QUEUEING_NOTE = "The agent is working — this message is queued for its next safe turn.";

function blocked(note: string): ContributionGate {
  return { enabled: false, note, queues: false };
}

/** The resume would reuse the resumable session's runtime, so a losing compete candidate must never decide the gate. */
function runtimeFor(
  sessions: readonly AgentSessionContract[],
  resumable: AgentSessionContract | null,
  descriptors: RuntimeDescriptor[],
): RuntimeDescriptor | undefined {
  const agentId = resumable?.agent_id ?? sessions.at(-1)?.agent_id;
  return descriptors.find((descriptor) => descriptor.id === agentId);
}

/**
 * Whether a message can be sent to this run right now, and whether it will be
 * delivered immediately or queued. It mirrors the daemon's own refusals so the
 * composer never offers an action the daemon would drop, and never suggests a
 * delivery the run can no longer perform.
 */
export function resolveContributionGate(
  detail: RunDetail,
  descriptors: RuntimeDescriptor[] | undefined,
  connectionState: ConnectionState,
): ContributionGate {
  if (connectionState !== "online") {
    return blocked("Daemon offline — reconnect to send a message.");
  }
  if (isRunTerminal(detail.run.status)) {
    return blocked("This run is finished — its session can no longer be resumed.");
  }
  if (detail.sessions.length === 0) {
    return blocked("This run has not started an agent session yet.");
  }
  if (descriptors === undefined) {
    return blocked("Checking runtime availability…");
  }
  const resting = canFollowUpRun(detail.run.status);
  const resumable =
    selectLatestResumableSession(detail.sessions, detail.steps, detail.compete_groups) ?? null;
  const runtime = runtimeFor(detail.sessions, resting ? resumable : null, descriptors);
  if (!runtime) {
    return blocked("This run's runtime is not registered on the daemon.");
  }
  if (!runtime.capabilities.resume) {
    return blocked(`${runtime.display_name} does not support resuming a session.`);
  }
  if (runtime.availability.status !== "available") {
    return blocked(`${runtime.display_name} is not available on this machine.`);
  }
  if (!resting) {
    return { enabled: true, note: QUEUEING_NOTE, queues: true };
  }
  if (resumable === null) {
    return blocked("No provider session to resume yet.");
  }
  return { enabled: true, note: RESTING_NOTE, queues: false };
}

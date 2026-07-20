import {
  canFollowUpRun,
  isRunTerminal,
  type RunDetail,
  type RuntimeDescriptor,
} from "@otomat/domain";
import type { ConnectionState } from "@otomat/ui";

export interface FollowUpGate {
  enabled: boolean;
  /** Honest reason the composer shows while the action is disabled; null when enabled. */
  reason: string | null;
}

const ENABLED: FollowUpGate = { enabled: true, reason: null };

function disabled(reason: string): FollowUpGate {
  return { enabled: false, reason };
}

/**
 * Whether a user follow-up can be sent right now, mirroring the daemon's refusal
 * guards so the UI never offers an action the daemon would reject.
 */
export function resolveFollowUpGate(
  detail: RunDetail,
  descriptors: RuntimeDescriptor[] | undefined,
  connectionState: ConnectionState,
): FollowUpGate {
  if (connectionState !== "online") {
    return disabled("Daemon offline — reconnect to send a follow-up.");
  }
  const status = detail.run.status;
  if (isRunTerminal(status)) {
    return disabled("This run is finished — its session can no longer be resumed.");
  }
  if (!canFollowUpRun(status)) {
    return disabled("The agent is working — follow-up unlocks when the run pauses.");
  }
  const resumable = detail.sessions.find((session) => session.provider_session_id !== null);
  if (!resumable) {
    return disabled("No provider session to resume yet.");
  }
  if (descriptors === undefined) {
    return disabled("Checking runtime availability…");
  }
  const runtime = descriptors.find((descriptor) => descriptor.id === resumable.agent_id);
  if (!runtime) {
    return disabled("This run's runtime is not registered on the daemon.");
  }
  if (!runtime.capabilities.resume) {
    return disabled(`${runtime.display_name} does not support resuming a session.`);
  }
  if (runtime.availability.status !== "available") {
    return disabled(`${runtime.display_name} is not available on this machine.`);
  }
  return ENABLED;
}

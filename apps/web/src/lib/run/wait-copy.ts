import type { RunWait } from "@otomat/domain";

/** One sentence naming what a run is waiting on, for the launch toast and the cockpit strip. */
export function describeRunWait(wait: RunWait): string {
  if (wait.kind === "workflow_dependency") {
    return `Waiting on ${wait.blocked_by.join(", ")} to finish.`;
  }
  const place = wait.position === 1 ? "next in line" : `#${wait.position} in line`;
  const load = `${wait.active_sessions} of ${wait.max_concurrent_sessions} agent sessions active`;
  return `${place} — ${load} on this host.`;
}

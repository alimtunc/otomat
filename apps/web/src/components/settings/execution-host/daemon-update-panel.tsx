import type { RemoteHostPhase } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { describeRemoteStatus } from "@web/components/shell/remote-session/status-labels";

import { useDaemonUpdate } from "./use-daemon-update";

const RUNS_KEEP_GOING =
  "Runs already started keep going on the host: closing Otomat does not stop them, and reopening finds them again. The update installs itself once they finish.";

const UPDATE_PHASES: RemoteHostPhase[] = [
  "checking_version",
  "waiting_for_runs",
  "installing_update",
  "verifying_update",
];

/**
 * Where the host's daemon build stands and what Otomat is doing about it. The install runs by
 * itself from every connection; the button here is the retry for a failure the user has fixed.
 */
export function DaemonUpdatePanel() {
  const remote = useRemoteSession();
  const update = useDaemonUpdate();
  if (remote.alias === null) return null;

  const status = remote.status;
  const waiting = status?.phase === "waiting_for_runs";
  const failure = update.error ?? remote.updateError;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Daemon build</h3>
      {remote.stale ? (
        <p role="status" className="text-xs text-warning">
          The host runs build {remote.build}, this app expects {remote.expectedBuild}. Otomat
          downloads and installs that exact build by itself, once the host has no run in flight.
        </p>
      ) : (
        <p className="text-xs text-text-secondary">
          The host runs the build this app expects
          {remote.build === null ? "" : ` (${remote.build})`}.
        </p>
      )}
      {status !== null && UPDATE_PHASES.includes(status.phase) ? (
        <p role="status" className="text-xs text-text-secondary">
          {describeRemoteStatus(status)}
          {waiting ? ` ${RUNS_KEEP_GOING}` : null}
        </p>
      ) : null}
      {failure === null ? null : (
        <p role="alert" className="text-xs text-danger">
          The last update stopped: {failure} The daemon that was running is untouched, and its
          database with it.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          loading={update.running}
          disabled={update.running || remote.expectedBuild === null}
          onClick={update.retry}
        >
          {`Install ${remote.expectedBuild ?? "this build"} now`}
        </Button>
        <span className="text-xs text-text-tertiary">
          {remote.expectedBuild === null
            ? "This build cannot name its own commit, so nothing is installed automatically."
            : "Runs the same install the host performs by itself; it still waits for the runs in flight."}
        </span>
      </div>
    </div>
  );
}

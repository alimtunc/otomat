import { Button } from "@otomat/ui";
import type { ReactNode } from "react";

import { InstanceRow } from "./instance-row";
import { useRemoteInstances } from "./use-remote-instances";

export interface InstancesPanelProps {
  sshAlias: string | null;
  expectedBuild: string | null;
  remoteBuild: string | null;
}

export function InstancesPanel({ sshAlias, expectedBuild, remoteBuild }: InstancesPanelProps) {
  const state = useRemoteInstances(sshAlias);
  if (!state.available) return null;
  const stale = expectedBuild !== null && remoteBuild !== null && expectedBuild !== remoteBuild;

  let list: ReactNode;
  if (state.listError !== null) {
    list = (
      <p role="alert" className="text-xs text-danger">
        Could not list the instances: {state.listError}
      </p>
    );
  } else if (state.instances === undefined) {
    list = <p className="text-xs text-text-tertiary">Listing instances…</p>;
  } else if (state.instances.length === 0) {
    list = <p className="text-xs text-text-tertiary">No test instances on this host.</p>;
  } else {
    list = (
      <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
        {state.instances.map((instance) => (
          <InstanceRow
            key={instance.build}
            instance={instance}
            pending={state.pending}
            onStop={state.stop}
            onRemove={state.remove}
          />
        ))}
      </div>
    );
  }

  let deployHint = "Downloads the CI bundle on the host; nothing starts automatically.";
  if (expectedBuild === null) {
    deployHint = "This build cannot name its own commit.";
  } else if (stale) {
    deployHint = `The host runs ${remoteBuild ?? "an unknown build"}; after the deploy it restarts by itself once idle.`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Deployments on this host</h3>
        <p className="text-xs text-text-secondary">
          Test instances live under <code>~/.otomat/instances/&lt;build&gt;</code>, one isolated
          daemon per build, beside — never inside — the stable daemon&apos;s data. Nothing here
          starts or stops without an explicit action.
        </p>
      </div>
      {list}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={state.updateDaemon}
          disabled={state.pending !== null || expectedBuild === null}
        >
          {state.pending === "update"
            ? "Deploying…"
            : `Deploy ${expectedBuild ?? "this build"} to this host`}
        </Button>
        <span className="text-xs text-text-tertiary">{deployHint}</span>
      </div>
      {state.actionError !== null ? (
        <p role="alert" className="text-xs text-danger">
          {state.actionError}
        </p>
      ) : null}
    </div>
  );
}

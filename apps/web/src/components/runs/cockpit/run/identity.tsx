import type { RunState } from "@otomat/domain";
import { CopyButton, RunStatusChip } from "@otomat/ui";
import { shortId } from "@web/lib/ids";

export interface RunIdentityProps {
  runId: string;
  status: RunState | undefined;
}

export function RunIdentity({ runId, status }: RunIdentityProps) {
  return (
    <span className="flex flex-none items-center gap-1.5">
      {status === undefined ? null : <RunStatusChip status={status} />}
      <span className="font-mono text-xs text-text-tertiary">{shortId(runId)}</span>
      <CopyButton value={runId} label="Copy run id" copiedLabel="Run id copied" />
    </span>
  );
}

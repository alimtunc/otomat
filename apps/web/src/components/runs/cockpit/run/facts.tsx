import type { RunDetail } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { useRunUsage } from "@web/api/runs/queries";
import { CopyablePath } from "@web/components/runs/copyable-path";
import { UsageTokens } from "@web/components/runs/usage/tokens";
import type { ReactNode } from "react";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="m-0 flex w-full min-w-0 items-center justify-end gap-1.5 text-foreground">
        {children}
      </dd>
    </>
  );
}

export function RunFacts({ detail }: { detail: RunDetail }) {
  const usage = useRunUsage(detail.run.id);
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 rounded-lg border border-border-subtle bg-surface-1 p-3.5 text-sm">
      <Fact label="state">
        <RunStatusChip status={detail.run.status} />
      </Fact>
      <Fact label="branch">
        <CopyablePath value={detail.run.branch} label="branch" />
      </Fact>
      <Fact label="worktree">
        {detail.worktree_path === null ? (
          <span className="text-xs text-text-tertiary">Not recorded</span>
        ) : (
          <CopyablePath value={detail.worktree_path} label="worktree path" />
        )}
      </Fact>
      <Fact label="sessions">
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {detail.sessions.length}
        </span>
      </Fact>
      <Fact label="tokens">
        {usage.data !== undefined ? (
          <UsageTokens usage={usage.data.total} />
        ) : (
          <span className="text-xs text-text-tertiary">
            {usage.isError ? "Usage could not be read" : "Loading…"}
          </span>
        )}
      </Fact>
    </dl>
  );
}

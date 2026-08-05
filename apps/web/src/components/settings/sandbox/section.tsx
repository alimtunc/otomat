import { Button, EmptyState } from "@otomat/ui";
import { SectionHeading } from "@web/components/settings/section-heading";

import { useSandboxReset } from "./use-sandbox-reset";

export function SandboxSection() {
  const sandbox = useSandboxReset();
  return (
    <div>
      <SectionHeading
        title="Sandbox"
        description="A disposable test repository with fixture issues, seeded on first launch. Break it freely — resetting brings back a clean, known state."
      />
      {sandbox.available ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Resetting stops the daemon, wipes the sandbox database, runs, worktrees and the test
            repository, then restarts and reseeds. Logs and the execution-host configuration are
            kept.
          </p>
          <div>
            <Button variant="destructive" onClick={sandbox.reset} disabled={sandbox.pending}>
              {sandbox.pending ? "Resetting…" : "Reset test data"}
            </Button>
          </div>
          {sandbox.error !== null ? (
            <p role="alert" className="text-xs text-danger">
              {sandbox.error}
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon="wand-2"
          variant="inline"
          title="Preview builds only"
          description="The sandbox exists only in packaged preview builds. Dev checkouts keep their per-worktree data, and the stable app never sees fixtures."
        />
      )}
    </div>
  );
}

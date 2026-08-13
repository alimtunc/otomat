import type { PullRequestSync } from "@otomat/domain";
import { Button, Chip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { usePushPullRequestCommits } from "@web/api/prs/mutations";
import { PullRequestCommitList } from "@web/components/runs/pr/sync/commit-list";
import { ForcePushDialog } from "@web/components/runs/pr/sync/force-push-dialog";
import { pullRequestSyncModel } from "@web/components/runs/pr/sync/model";
import { useState } from "react";

export interface PullRequestSyncPanelProps {
  runId: string;
  headRef: string;
  sync: PullRequestSync;
}

/** Publishing commits, kept apart from editing details: this panel only ever moves commits. */
export function PullRequestSyncPanel({ runId, headRef, sync }: PullRequestSyncPanelProps) {
  const [confirmingForce, setConfirmingForce] = useState(false);
  const push = usePushPullRequestCommits(runId);
  const model = pullRequestSyncModel(sync);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <Chip tone={model.tone}>{model.stateLabel}</Chip>
        <div className="flex shrink-0 items-center gap-2">
          {sync.dirty ? (
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link to="/runs/$runId" params={{ runId }}>
                  Open run to commit
                </Link>
              }
            />
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={model.pushDisabled}
            loading={push.isPending}
            onClick={() => push.mutate({})}
          >
            Push commits
          </Button>
          {model.forceExpectedSha === null ? null : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={push.isPending}
              onClick={() => setConfirmingForce(true)}
            >
              Force push with lease…
            </Button>
          )}
        </div>
      </div>
      <p className="m-0 text-sm text-text-secondary">{model.description}</p>
      <PullRequestCommitList label={`Commits to publish on ${headRef}`} commits={sync.ahead} />
      {model.forceExpectedSha === null ? null : (
        <ForcePushDialog
          headRef={headRef}
          sync={sync}
          expectedRemoteSha={model.forceExpectedSha}
          open={confirmingForce}
          onOpenChange={setConfirmingForce}
          isPending={push.isPending}
          onConfirm={(expected) =>
            push.mutate(
              { expected_remote_sha: expected },
              { onSuccess: () => setConfirmingForce(false) },
            )
          }
        />
      )}
    </section>
  );
}

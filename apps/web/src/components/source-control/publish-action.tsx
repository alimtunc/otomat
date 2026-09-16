import type { CheckoutTarget, SourceControlResponse } from "@otomat/domain";
import { Button, Dialog, DialogTrigger } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { RepositoryPullRequestDialog } from "@web/components/source-control/repository/dialog";
import { useState } from "react";

export interface PublishActionProps {
  target: CheckoutTarget;
  changes: SourceControlResponse;
  disabled: boolean;
}

export function PublishAction({ target, changes, disabled }: PublishActionProps) {
  const [open, setOpen] = useState(false);
  if (target.kind === "run")
    return (
      <Button
        size="xs"
        variant="outline"
        render={
          <Link to="/runs/$runId/pr" params={{ runId: target.id }}>
            Pull request
          </Link>
        }
      />
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="xs" variant="outline" disabled={disabled}>
            Create / update PR…
          </Button>
        }
      />
      {open ? (
        <RepositoryPullRequestDialog
          repositoryId={target.id}
          branch={changes.branch}
          revision={changes.revision}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}

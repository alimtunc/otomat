import type { CheckoutTarget, SourceControlResponse } from "@otomat/domain";
import { Button, Dialog } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { RepositoryPullRequestDialog } from "@web/components/source-control/repository-pr-dialog";
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
      <Button size="xs" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        Create / update PR…
      </Button>
      {open ? (
        <RepositoryPullRequestDialog
          repositoryId={target.id}
          changes={changes}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}

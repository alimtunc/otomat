import { isWorkspaceForceCleanable, type WorkspaceEntry } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { useReconcileWorkspaces } from "@web/api/workspaces/mutations";
import { WorkspaceCleanupDialog } from "@web/components/workspaces/cleanup-dialog";
import { useActiveHostDescriptor } from "@web/lib/active-host";
import { useState } from "react";

export function WorkspaceActions({ entry }: { entry: WorkspaceEntry }) {
  const [cleaning, setCleaning] = useState(false);
  const reconcile = useReconcileWorkspaces();
  const host = useActiveHostDescriptor();
  const cleanable = isWorkspaceForceCleanable(entry);

  return (
    <div className="mt-2.5 flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        loading={reconcile.isPending}
        disabled={reconcile.isPending}
        onClick={() => reconcile.mutate(host.id)}
      >
        <Icon name="refresh-cw" aria-hidden />
        Reconcile
      </Button>
      {cleanable ? (
        <>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => setCleaning(true)}
          >
            Clean workspace…
          </Button>
          <WorkspaceCleanupDialog
            rows={[{ ...entry, host }]}
            open={cleaning}
            onOpenChange={setCleaning}
          />
        </>
      ) : null}
    </div>
  );
}

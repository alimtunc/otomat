import type { LinearIssueSnapshot, LinearTeamMetadata } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";
import { linearPriorityLabel } from "@web/lib/linear-priority";

import type { EditorFormValues } from "../editable-fields";
import { CompareRow } from "./row";
import { localAssigneeName, localLabelNames } from "./values";

export function ConflictDialog({
  local,
  metadata,
  remote,
  pending,
  onOverwrite,
  onRefresh,
  onAbandon,
}: {
  local: EditorFormValues;
  metadata: LinearTeamMetadata | null;
  remote: LinearIssueSnapshot;
  pending: boolean;
  onOverwrite: () => void;
  onRefresh: () => void;
  onAbandon: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onAbandon())}>
      <DialogContent aria-label="Resolve Linear conflict">
        <DialogHeader>
          <DialogTitle>The issue changed on Linear</DialogTitle>
          <DialogDescription>
            Someone updated this issue while you were editing. Choose how to resolve it — nothing is
            written to Linear without your confirmation.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 text-xs font-semibold text-text-secondary">
            <span />
            <span>Your draft</span>
            <span>On Linear</span>
          </div>
          <CompareRow label="Title" local={local.title} remote={remote.title} />
          <CompareRow
            label="Priority"
            local={linearPriorityLabel(local.priority)}
            remote={linearPriorityLabel(remote.priority)}
          />
          <CompareRow
            label="Assignee"
            local={localAssigneeName(local, metadata, remote)}
            remote={remote.assignee?.name ?? "Unassigned"}
          />
          <CompareRow
            label="Labels"
            local={localLabelNames(local, metadata, remote)}
            remote={remote.labels.map((label) => label.name).join(", ") || "—"}
          />
          <CompareRow
            label="Description"
            local={local.description || "—"}
            remote={remote.description ?? "—"}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRefresh}>
            Refresh from Linear
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onAbandon}>
            Keep my draft
          </Button>
          <Button type="button" variant="primary" size="sm" loading={pending} onClick={onOverwrite}>
            Overwrite Linear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

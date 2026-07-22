import { LINEAR_PRIORITIES } from "@otomat/domain";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@otomat/ui";
import { usePublishLinearStatus } from "@web/api/linear/writeback";
import { ColorDot } from "@web/components/issues/color-dot";
import { RailRow, Unknown } from "@web/components/issues/workspace/rail/rail-primitives";
import { linearPriorityLabel } from "@web/lib/linear-priority";
import type { ReactNode } from "react";

import { UNASSIGNED } from "./editable-fields";
import type { LinearIssueEditing } from "./use-linear-issue-editing";

const TRIGGER_CLASS =
  "-my-0.5 inline-flex min-w-0 items-center justify-end gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-foreground transition-colors duration-100 hover:bg-surface-2 disabled:pointer-events-none";

function RowTrigger({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <DropdownMenuTrigger disabled={disabled} className={TRIGGER_CLASS}>
      {children}
    </DropdownMenuTrigger>
  );
}

function StatusRow({
  editing,
  issueId,
  runId,
}: {
  editing: LinearIssueEditing;
  issueId: string;
  runId: string | null;
}) {
  const publishStatus = usePublishLinearStatus(issueId);
  const { snapshot, metadata } = editing;
  if (snapshot === null) return <Unknown />;
  const disabled = metadata === null || publishStatus.isPending;
  return (
    <DropdownMenu>
      <RowTrigger disabled={disabled}>
        <ColorDot color={snapshot.state.color} />
        <span className="whitespace-nowrap">{snapshot.state.name}</span>
      </RowTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={snapshot.state.id}
          onValueChange={(value: string) => {
            if (value !== snapshot.state.id) {
              publishStatus.mutate({ state_id: value, run_id: runId });
            }
          }}
        >
          {(metadata?.states ?? []).map((state) => (
            <DropdownMenuRadioItem key={state.id} value={state.id}>
              <span className="inline-flex items-center gap-2">
                <ColorDot color={state.color} />
                {state.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityRow({ editing }: { editing: LinearIssueEditing }) {
  const { values } = editing;
  if (values === null) return <Unknown />;
  return (
    <DropdownMenu>
      <RowTrigger disabled={!editing.canEdit}>{linearPriorityLabel(values.priority)}</RowTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={values.priority}
          onValueChange={(value: number) => editing.updateFields({ priority: value })}
        >
          {LINEAR_PRIORITIES.map((priority) => (
            <DropdownMenuRadioItem key={priority.value} value={priority.value}>
              {priority.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeRow({ editing }: { editing: LinearIssueEditing }) {
  const { values, metadata, snapshot } = editing;
  if (values === null) return <Unknown />;
  const assigneeName =
    values.assignee_id === null
      ? "Unassigned"
      : (metadata?.members.find((member) => member.id === values.assignee_id)?.name ??
        (snapshot?.assignee?.id === values.assignee_id ? snapshot.assignee.name : "…"));
  return (
    <DropdownMenu>
      <RowTrigger disabled={!editing.canEdit || metadata === null}>
        <span
          className={cn(
            "whitespace-nowrap",
            values.assignee_id === null ? "text-text-tertiary" : "",
          )}
        >
          {assigneeName}
        </span>
      </RowTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={values.assignee_id ?? UNASSIGNED}
          onValueChange={(value: string) =>
            editing.updateFields({ assignee_id: value === UNASSIGNED ? null : value })
          }
        >
          <DropdownMenuRadioItem value={UNASSIGNED}>Unassigned</DropdownMenuRadioItem>
          {(metadata?.members ?? []).map((member) => (
            <DropdownMenuRadioItem key={member.id} value={member.id}>
              {member.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LinearPropertyRows({
  editing,
  issueId,
  runId,
}: {
  editing: LinearIssueEditing;
  issueId: string;
  runId: string | null;
}) {
  return (
    <>
      <RailRow label="Status">
        <StatusRow editing={editing} issueId={issueId} runId={runId} />
      </RailRow>
      <RailRow label="Priority">
        <PriorityRow editing={editing} />
      </RailRow>
      <RailRow label="Assignee">
        <AssigneeRow editing={editing} />
      </RailRow>
    </>
  );
}

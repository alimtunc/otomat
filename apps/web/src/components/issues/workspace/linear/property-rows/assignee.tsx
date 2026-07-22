import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@otomat/ui";
import { Unknown } from "@web/components/issues/workspace/rail/rail-primitives";

import { UNASSIGNED } from "../editable-fields";
import type { LinearIssueEditing } from "../use-issue-editing";
import { Trigger } from "./trigger";

export function AssigneeRow({ editing }: { editing: LinearIssueEditing }) {
  const { values, metadata, snapshot } = editing;
  if (values === null) return <Unknown />;
  const assigneeName =
    values.assignee_id === null
      ? "Unassigned"
      : (metadata?.members.find((member) => member.id === values.assignee_id)?.name ??
        (snapshot?.assignee?.id === values.assignee_id ? snapshot.assignee.name : "…"));
  return (
    <DropdownMenu>
      <Trigger disabled={!editing.canEdit || metadata === null}>
        <span
          className={cn(
            "whitespace-nowrap",
            values.assignee_id === null ? "text-text-tertiary" : "",
          )}
        >
          {assigneeName}
        </span>
      </Trigger>
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

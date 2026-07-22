import { LINEAR_PRIORITIES } from "@otomat/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@otomat/ui";
import { Unknown } from "@web/components/issues/workspace/rail/rail-primitives";
import { linearPriorityLabel } from "@web/lib/linear-priority";

import type { LinearIssueEditing } from "../use-issue-editing";
import { Trigger } from "./trigger";

export function PriorityRow({ editing }: { editing: LinearIssueEditing }) {
  const { values } = editing;
  if (values === null) return <Unknown />;
  return (
    <DropdownMenu>
      <Trigger disabled={!editing.canEdit}>{linearPriorityLabel(values.priority)}</Trigger>
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

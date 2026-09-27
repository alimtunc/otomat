import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@otomat/ui";
import { usePublishLinearStatus } from "@web/api/linear/writeback";
import { LinearStateIcon } from "@web/components/issues/linear-state-icon";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";

import type { LinearIssueEditing } from "../use-issue-editing";
import { Trigger } from "./trigger";

export function StatusRow({
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
      <Trigger disabled={disabled}>
        <LinearStateIcon state={snapshot.state} />
        <span className="whitespace-nowrap">{snapshot.state.name}</span>
      </Trigger>
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
                <LinearStateIcon state={state} />
                {state.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

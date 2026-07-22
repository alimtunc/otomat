import { RailRow } from "@web/components/issues/workspace/rail/rail-primitives";

import type { LinearIssueEditing } from "../use-issue-editing";
import { AssigneeRow } from "./assignee";
import { PriorityRow } from "./priority";
import { StatusRow } from "./status";

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

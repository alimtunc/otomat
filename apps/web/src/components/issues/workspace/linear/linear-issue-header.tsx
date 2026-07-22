import type { IssueContract } from "@otomat/domain";
import { Avatar, IssueSourceGlyph } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { issueShortId } from "@web/lib/ids";

import { DraftBar } from "./draft-bar";
import { InlineTextField } from "./inline-text-field";
import { useLinearIssueEditing, type LinearIssueEditing } from "./use-linear-issue-editing";

function assigneeName(issue: IssueContract, editing: LinearIssueEditing): string | null {
  const { values, metadata, snapshot } = editing;
  if (values === null) return issue.source_assignee_name;
  if (values.assignee_id === null) return null;
  return (
    metadata?.members.find((member) => member.id === values.assignee_id)?.name ??
    (snapshot?.assignee?.id === values.assignee_id ? snapshot.assignee.name : null) ??
    issue.source_assignee_name
  );
}

export function LinearIssueHeader({ issue }: { issue: IssueContract }) {
  const editing = useLinearIssueEditing(issue.id);
  const title = editing.values?.title ?? issue.title;
  const description = editing.values?.description ?? issue.body ?? "";

  const assignee = assigneeName(issue, editing);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <InlineTextField
              value={title}
              placeholder="Issue title"
              ariaLabel="Issue title"
              disabled={!editing.canEdit}
              className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
              onCommit={(next) => {
                if (next.length > 0) editing.updateFields({ title: next });
              }}
            />
          </div>
          {assignee !== null ? (
            <span className="mt-1" title={`Assigned to ${assignee}`}>
              <Avatar name={assignee} />
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <IssueSourceGlyph source={issue.source} />
          <span className="font-mono">{issueShortId(issue)}</span>
          {editing.snapshot !== null ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <ColorDot color={editing.snapshot.state.color} />
                {editing.snapshot.state.name}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <DraftBar editing={editing} />
      <InlineTextField
        multiline
        value={description}
        placeholder="Add a description…"
        ariaLabel="Issue description"
        disabled={!editing.canEdit}
        className="text-sm leading-[1.65] text-foreground"
        onCommit={(next) => editing.updateFields({ description: next })}
      />
    </div>
  );
}

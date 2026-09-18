import type { IssueContract } from "@otomat/domain";
import { Avatar } from "@otomat/ui";
import { IssueDescription } from "@web/components/issues/issue/description";
import { IssueMetadata } from "@web/components/issues/issue/metadata";
import type { ReactNode } from "react";

import { DraftBar } from "./draft-bar";
import { InlineTextField } from "./inline-text-field";
import { LinearAttachmentsSection, LinearMediaProvider } from "./media";
import { useLinearIssueEditing, type LinearIssueEditing } from "./use-issue-editing";

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

export function LinearIssueHeader({
  issue,
  children,
  hasRun = false,
  comments,
}: {
  issue: IssueContract;
  children?: ReactNode;
  hasRun?: boolean;
  comments?: ReactNode;
}) {
  const editing = useLinearIssueEditing(issue.id);
  const title = editing.values?.title ?? issue.title;
  const description = editing.values?.description ?? issue.body ?? "";
  const assignee = assigneeName(issue, editing);

  return (
    <div className="flex shrink-0 flex-col gap-3.5">
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
        <IssueMetadata issue={issue} linearState={editing.snapshot?.state} />
      </div>
      <DraftBar editing={editing} />
      {children}
      <LinearMediaProvider issueId={issue.id}>
        <IssueDescription
          key={`${issue.id}:${hasRun}`}
          body={description}
          collapsed={hasRun}
          comments={comments}
        >
          <InlineTextField
            multiline
            value={description}
            placeholder="Add a description…"
            ariaLabel="Issue description"
            disabled={!editing.canEdit}
            className="text-sm leading-[1.65] text-foreground"
            onCommit={(next) => editing.updateFields({ description: next })}
          />
          <LinearAttachmentsSection issueId={issue.id} />
        </IssueDescription>
      </LinearMediaProvider>
    </div>
  );
}

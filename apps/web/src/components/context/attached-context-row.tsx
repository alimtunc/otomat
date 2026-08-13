import { contextReferenceKey, type ContextReference, type IssueContract } from "@otomat/domain";
import { useProjectIssues } from "@web/api/issues/queries";
import { ContextChip } from "@web/components/context/context-chip";
import { ContextIssuePreview } from "@web/components/context/context-issue-preview";
import { issueShortId } from "@web/lib/ids";
import type { ReactNode } from "react";

const FILE_PREVIEW =
  "Attached by path. Its content is read from the repository snapshot at launch, so a file that moved, is binary or is past the size limit is reported rather than guessed.";

export interface AttachedContextRowProps {
  /** The issue Otomat attaches on its own; null for a run that has none. */
  issue: IssueContract | null;
  references: readonly ContextReference[];
  onRemove: (key: string) => void;
  label: string;
  addControl: ReactNode;
}

/** The attached context, shown as chips above the instruction, in the order it was attached. */
export function AttachedContextRow({
  issue,
  references,
  onRemove,
  label,
  addControl,
}: AttachedContextRowProps) {
  const issues = useProjectIssues(issue?.project_id);
  const byId = new Map((issues.data ?? []).map((entry) => [entry.id, entry]));

  const referenceChip = (reference: ContextReference): ReactNode => {
    const key = contextReferenceKey(reference);
    if (reference.kind === "file") {
      return (
        <ContextChip
          key={key}
          icon="file-text"
          label={reference.path}
          preview={<p>{FILE_PREVIEW}</p>}
          onRemove={() => onRemove(key)}
        />
      );
    }
    const referenced = byId.get(reference.issue_id);
    return (
      <ContextChip
        key={key}
        icon="list-todo"
        label={referenced ? issueShortId(referenced) : reference.issue_id}
        preview={
          referenced ? (
            <ContextIssuePreview issue={referenced} />
          ) : (
            <p>This issue is not loaded in this project.</p>
          )
        }
        onRemove={() => onRemove(key)}
      />
    );
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="list"
      aria-label={`${label} context`}
    >
      {issue === null ? null : (
        <ContextChip
          icon="list-todo"
          label={issueShortId(issue)}
          preview={<ContextIssuePreview issue={issue} />}
        />
      )}
      {references.map(referenceChip)}
      {addControl}
    </div>
  );
}

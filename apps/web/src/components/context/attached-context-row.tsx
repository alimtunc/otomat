import { contextReferenceKey, type ContextReference, type IssueContract } from "@otomat/domain";
import { useProjectIssues } from "@web/api/issues/queries";
import { ContextChip } from "@web/components/context/context-chip";
import { ContextIssuePreview } from "@web/components/context/context-issue-preview";
import { issueShortId } from "@web/lib/ids";
import type { ReactNode } from "react";

const FILE_PREVIEW =
  "Attached by path. Its content is read from the repository snapshot at launch, so a file that moved, is binary or is past the size limit is reported rather than guessed.";

/** The internal id is never a label, so an unresolved reference stays neutral rather than leaking it. */
const UNRESOLVED_ISSUE = "Issue";

function unresolvedPreview(loading: boolean, failed: boolean): string {
  if (loading) return "Resolving this issue’s identifier from the project.";
  if (failed) return "This project’s issues could not be loaded.";
  return "This issue is not loaded in this project.";
}

export interface AttachedContextRowProps {
  /** The issue Otomat attaches on its own; null for a run that has none. */
  issue: IssueContract | null;
  projectId: string | undefined;
  references: readonly ContextReference[];
  onRemove?: (key: string) => void;
  label: string;
  addControl?: ReactNode;
}

/** The attached context, shown as chips above the instruction, in the order it was attached. */
export function AttachedContextRow({
  issue,
  projectId,
  references,
  onRemove,
  label,
  addControl,
}: AttachedContextRowProps) {
  const issues = useProjectIssues(projectId);
  const byId = new Map((issues.data ?? []).map((entry) => [entry.id, entry]));

  const referenceChip = (reference: ContextReference): ReactNode => {
    const key = contextReferenceKey(reference);
    const remove = onRemove === undefined ? undefined : () => onRemove(key);
    if (reference.kind === "file") {
      return (
        <li key={key}>
          <ContextChip
            icon="file-text"
            label={reference.path}
            preview={<p>{FILE_PREVIEW}</p>}
            onRemove={remove}
          />
        </li>
      );
    }
    const referenced = byId.get(reference.issue_id);
    return (
      <li key={key}>
        <ContextChip
          icon="list-todo"
          label={referenced ? issueShortId(referenced) : UNRESOLVED_ISSUE}
          preview={
            referenced ? (
              <ContextIssuePreview issue={referenced} />
            ) : (
              <p>{unresolvedPreview(issues.isLoading, issues.isError)}</p>
            )
          }
          onRemove={remove}
        />
      </li>
    );
  };

  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label={`${label} context`}>
      {issue === null ? null : (
        <li>
          <ContextChip
            icon="list-todo"
            label={issueShortId(issue)}
            preview={<ContextIssuePreview issue={issue} />}
          />
        </li>
      )}
      {references.map(referenceChip)}
      {addControl === undefined ? null : <li>{addControl}</li>}
    </ul>
  );
}

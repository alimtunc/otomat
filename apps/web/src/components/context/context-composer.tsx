import { contextReferenceKey, type IssueContract } from "@otomat/domain";
import { useRepositories } from "@web/api/daemon/queries";
import { AddContextPopover } from "@web/components/context/add-context-popover";
import { AttachedContextRow } from "@web/components/context/attached-context-row";
import { ContextNoteField } from "@web/components/context/note-field";
import {
  addContextReference,
  removeContextReference,
  type ContextDraft,
} from "@web/lib/context/draft";

export interface ContextComposerProps {
  /** The issue Otomat attaches on its own; it is shown, previewable, and not detachable. */
  issue: IssueContract | null;
  projectId: string | undefined;
  value: ContextDraft;
  onChange: (draft: ContextDraft) => void;
  /** Names this composer's controls for assistive tech: "Single run", "Step 2", … */
  label: string;
  noteRows?: number;
  autoFocus?: boolean;
}

/** References are objects the daemon resolves at launch, never text copied into the note. */
export function ContextComposer({
  issue,
  projectId,
  value,
  onChange,
  label,
  noteRows = 3,
  autoFocus = false,
}: ContextComposerProps) {
  const repositories = useRepositories(projectId);
  const repository = repositories.data?.find((entry) => entry.available) ?? null;
  const attachedKeys = new Set(value.references.map(contextReferenceKey));

  return (
    <div className="flex flex-col gap-2">
      <AttachedContextRow
        issue={issue}
        projectId={projectId}
        references={value.references}
        onRemove={(key) =>
          onChange({ ...value, references: removeContextReference(value.references, key) })
        }
        label={label}
        addControl={
          <AddContextPopover
            projectId={projectId}
            repositoryId={repository?.id ?? null}
            attachedKeys={attachedKeys}
            onAdd={(reference) =>
              onChange({ ...value, references: addContextReference(value.references, reference) })
            }
            label={label}
          />
        }
      />
      <ContextNoteField
        value={value.note}
        onChange={(note) => onChange({ ...value, note })}
        label={label}
        rows={noteRows}
        autoFocus={autoFocus}
      />
    </div>
  );
}

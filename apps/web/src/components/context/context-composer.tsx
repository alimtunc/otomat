import { contextReferenceKey, type IssueContract } from "@otomat/domain";
import { Field, FieldControl, FieldLabel, Textarea } from "@otomat/ui";
import { useRepositories } from "@web/api/daemon/queries";
import { AddContextPopover } from "@web/components/context/add-context-popover";
import { AttachedContextRow } from "@web/components/context/attached-context-row";
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
        references={value.references}
        onRemove={(key) => onChange(removeContextReference(value, key))}
        label={label}
        addControl={
          <AddContextPopover
            projectId={projectId}
            repositoryId={repository?.id ?? null}
            attachedKeys={attachedKeys}
            onAdd={(reference) => onChange(addContextReference(value, reference))}
            label={label}
          />
        }
      />
      <Field>
        <FieldLabel>Additional step instructions (optional)</FieldLabel>
        <FieldControl>
          <Textarea
            autoFocus={autoFocus}
            rows={noteRows}
            value={value.note}
            onChange={(event) => onChange({ ...value, note: event.target.value })}
            placeholder="Anything the attached context and the agent’s own guidance do not already say"
            aria-label={`${label} instructions`}
          />
        </FieldControl>
      </Field>
    </div>
  );
}

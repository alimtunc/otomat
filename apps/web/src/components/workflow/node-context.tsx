import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextNoteField } from "@web/components/context/note-field";
import type { ContextDraft } from "@web/lib/context/draft";

export interface WorkflowNodeContextProps {
  /** The project this node can attach from; null on a preset, which attaches nothing. */
  projectId: string | null;
  value: ContextDraft;
  onChange: (draft: ContextDraft) => void;
  label: string;
}

/** What this node adds on its own. The workflow's issue is attached once, on the launcher's global row. */
export function WorkflowNodeContext({
  projectId,
  value,
  onChange,
  label,
}: WorkflowNodeContextProps) {
  const content =
    projectId === null ? (
      <ContextNoteField
        value={value.note}
        onChange={(note) => onChange({ ...value, note })}
        label={label}
        rows={2}
      />
    ) : (
      <ContextComposer
        issue={null}
        projectId={projectId}
        value={value}
        onChange={onChange}
        label={label}
        noteRows={2}
      />
    );
  return (
    <Collapsible>
      <CollapsibleTrigger
        render={<Button size="xs" variant="ghost" className="group justify-start" />}
        aria-label={`${label} context and instructions`}
      >
        <Icon name="plus" aria-hidden className="group-data-[panel-open]:hidden" />
        <Icon name="chevron-down" aria-hidden className="hidden group-data-[panel-open]:block" />
        Context & instructions
        {value.note.trim().length > 0 || value.references.length > 0 ? (
          <span aria-label="Context added" className="size-1.25 rounded-full bg-warning" />
        ) : null}
      </CollapsibleTrigger>
      <CollapsiblePanel keepMounted>{content}</CollapsiblePanel>
    </Collapsible>
  );
}

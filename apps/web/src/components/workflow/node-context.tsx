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
  if (projectId === null) {
    return (
      <ContextNoteField
        value={value.note}
        onChange={(note) => onChange({ ...value, note })}
        label={label}
        rows={2}
      />
    );
  }
  return (
    <ContextComposer
      issue={null}
      projectId={projectId}
      value={value}
      onChange={onChange}
      label={label}
      noteRows={2}
    />
  );
}

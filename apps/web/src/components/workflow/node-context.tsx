import { ContextComposer } from "@web/components/context/context-composer";
import { ContextNoteField } from "@web/components/context/note-field";
import type { ContextDraft } from "@web/lib/context/draft";
import type { WorkflowContextScope } from "@web/lib/workflow/context-scope";

export interface WorkflowNodeContextProps {
  scope: WorkflowContextScope | null;
  value: ContextDraft;
  onChange: (draft: ContextDraft) => void;
  label: string;
}

/** A preset attaches nothing, so it composes its static note alone; a launch composes both. */
export function WorkflowNodeContext({ scope, value, onChange, label }: WorkflowNodeContextProps) {
  if (scope === null) {
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
      issue={scope.issue}
      projectId={scope.projectId}
      value={value}
      onChange={onChange}
      label={label}
      noteRows={2}
    />
  );
}

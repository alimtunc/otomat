import { Field, FieldControl, FieldLabel, Textarea } from "@otomat/ui";

export interface ContextNoteFieldProps {
  value: string;
  onChange: (note: string) => void;
  label: string;
  rows?: number;
  autoFocus?: boolean;
}

export function ContextNoteField({
  value,
  onChange,
  label,
  rows = 3,
  autoFocus = false,
}: ContextNoteFieldProps) {
  return (
    <Field>
      <FieldLabel>Additional step instructions (optional)</FieldLabel>
      <FieldControl>
        <Textarea
          autoFocus={autoFocus}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Anything the attached context and the agent’s own guidance do not already say"
          aria-label={`${label} instructions`}
        />
      </FieldControl>
    </Field>
  );
}

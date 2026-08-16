import { Field, FieldControl, Input } from "@otomat/ui";
import { fieldErrorProps, type FieldMetaLike } from "@web/lib/form";

export interface WorkflowNameFieldProps {
  /** The `steps[…].name` field this node is labelled by, from the plan form. */
  field: {
    state: { value: string; meta: FieldMetaLike };
    handleBlur: () => void;
    handleChange: (value: string) => void;
  };
  /** The node's accessible name, already prefixed: "Step 2 name", "Candidate A name". */
  label: string;
  placeholder: string;
}

export function WorkflowNameField({ field, label, placeholder }: WorkflowNameFieldProps) {
  return (
    <Field className="flex-1" {...fieldErrorProps(field.state.meta)}>
      <FieldControl>
        <Input
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="h-7 text-sm"
        />
      </FieldControl>
    </Field>
  );
}

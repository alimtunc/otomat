import { WORKFLOW_PRESET_NAME_MAX_LENGTH } from "@otomat/domain";
import {
  Field,
  FieldControl,
  FieldLabel,
  Input,
  SegmentedControl,
  SegmentedItem,
} from "@otomat/ui";
import type { PresetForm } from "@web/components/workflow/preset/use-preset-form";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { PRESET_SCOPE_LABEL } from "@web/lib/workflow/preset";

export interface PresetIdentityFieldsProps {
  form: PresetForm;
  /** Undefined leaves the project scope unavailable: there is no project to bind the preset to. */
  projectId: string | undefined;
}

/** What identifies a preset and decides where it is offered, shared by both save surfaces. */
export function PresetIdentityFields({ form, projectId }: PresetIdentityFieldsProps) {
  return (
    <>
      <form.Field name="name" validators={{ onChange: requiredTrimmed("Name this preset.") }}>
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Name</FieldLabel>
            <FieldControl>
              <Input
                autoFocus
                value={field.state.value}
                maxLength={WORKFLOW_PRESET_NAME_MAX_LENGTH}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Implement, then review"
                aria-label="Preset name"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Field name="scope">
        {(field) => (
          <Field hint="A global preset is offered in every project; a project preset stays in this one.">
            <FieldLabel>Availability</FieldLabel>
            <SegmentedControl
              type="single"
              value={field.state.value}
              onValueChange={(value) => {
                if (value === "global" || value === "project") field.handleChange(value);
              }}
              aria-label="Preset availability"
            >
              <SegmentedItem value="global">{PRESET_SCOPE_LABEL.global}</SegmentedItem>
              <SegmentedItem value="project" disabled={projectId === undefined}>
                {PRESET_SCOPE_LABEL.project}
              </SegmentedItem>
            </SegmentedControl>
          </Field>
        )}
      </form.Field>
    </>
  );
}

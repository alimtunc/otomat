import type { ExecutionDefaults } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { useExecutionDefaultsForm } from "@web/components/settings/execution-defaults/use-form";

export function ExecutionDefaultsForm({ defaults }: { defaults: ExecutionDefaults }) {
  const runtimes = useRuntimes();
  const { form, isSaving, submitError } = useExecutionDefaultsForm(defaults);

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="execution">
        {(field) => (
          <Field>
            <FieldLabel>Default execution</FieldLabel>
            <FieldControl>
              <ExecutionConfigPicker
                runtimesOnly
                level="global"
                value={field.state.value}
                onChange={field.handleChange}
                profiles={[]}
                descriptors={runtimes.data ?? []}
                label="Global default"
                disabled={isSaving}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <p className="text-xs text-text-tertiary">
        These stay preferences: a launch checks them against the runtime installed on its host, and
        refuses rather than falling back to another model.
      </p>
      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="self-start"
        loading={isSaving}
        disabled={isSaving}
      >
        Save defaults
      </Button>
    </form>
  );
}

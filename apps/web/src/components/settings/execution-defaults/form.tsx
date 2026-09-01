import type { ExecutionDefaults } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { useExecutionDefaultsForm } from "@web/components/settings/execution-defaults/use-form";
import { SavedNotice } from "@web/components/settings/saved-notice";

export function ExecutionDefaultsForm({ defaults }: { defaults: ExecutionDefaults }) {
  const runtimes = useRuntimes();
  const { form, isSaving, isSaved, submitError } = useExecutionDefaultsForm(defaults);

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
                scope="runtimes"
                level="global"
                value={field.state.value}
                onChange={field.handleChange}
                profiles={[]}
                descriptors={runtimes.data ?? []}
                skills={[]}
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
      <form.Subscribe selector={(state) => state.isDefaultValue}>
        {(isDefault) => (
          <div className="flex items-center gap-2.5">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSaving}
              disabled={isSaving || isDefault}
            >
              Save defaults
            </Button>
            {isSaved && isDefault ? <SavedNotice>Execution defaults saved</SavedNotice> : null}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

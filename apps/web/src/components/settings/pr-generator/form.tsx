import type { ExecutionDefaults } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { usePullRequestGeneratorForm } from "@web/components/settings/pr-generator/use-form";

export function PullRequestGeneratorForm({ generator }: { generator: ExecutionDefaults }) {
  const runtimes = useRuntimes();
  const { form, isSaving, submitError } = usePullRequestGeneratorForm(generator);

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
            <FieldLabel>PR metadata generator</FieldLabel>
            <FieldControl>
              <ExecutionConfigPicker
                runtimesOnly
                level="global"
                value={field.state.value}
                onChange={field.handleChange}
                profiles={[]}
                descriptors={runtimes.data ?? []}
                label="PR metadata generator"
                disabled={isSaving}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <p className="text-xs text-text-tertiary">
        No agent selected means <strong>Same as run</strong>: the generation borrows the runtime and
        model the run froze. A configured provider or model that the execution host does not offer
        blocks the generation instead of falling back to the CLI default.
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
        Save generator
      </Button>
    </form>
  );
}

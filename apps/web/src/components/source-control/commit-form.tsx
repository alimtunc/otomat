import type { CheckoutTarget, SourceControlResponse } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Textarea, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useCommitFiles } from "@web/api/source-control/mutations";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { fieldErrorProps } from "@web/lib/form";

export interface CommitFormProps {
  target: CheckoutTarget;
  changes: SourceControlResponse;
  disabled: boolean;
}

export function CommitForm({ target, changes, disabled }: CommitFormProps) {
  const commit = useCommitFiles(target);
  const form = useForm({
    defaultValues: { message: "" },
    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await commit.mutateAsync({
          revision: changes.revision,
          message: value.message,
        });
        formApi.reset();
        toast.success(`Committed ${result.sha.slice(0, 7)} on ${changes.branch}`);
      } catch (error) {
        toast.error(sourceControlMessage(error));
      }
    },
  });
  const unavailable = disabled || changes.staged.length === 0 || changes.branch === "HEAD";
  return (
    <form
      className="flex shrink-0 flex-col gap-2 border-b border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="message"
        validators={{
          onChange: ({ value }) => (value.trim() === "" ? "Enter a commit message." : undefined),
        }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Commit message</FieldLabel>
            <FieldControl>
              <Textarea
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder="Describe your changes"
                rows={2}
                maxLength={10000}
                disabled={commit.isPending}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.values.message] as const}>
        {([canSubmit, message]) => (
          <Button
            type="submit"
            size="sm"
            disabled={unavailable || !canSubmit || message.trim() === ""}
            loading={commit.isPending}
          >
            Commit staged ({changes.staged.length})
          </Button>
        )}
      </form.Subscribe>
      <p className="truncate text-micro text-text-tertiary" title={changes.branch}>
        Commit to {changes.branch}. Unstaged changes stay local.
      </p>
    </form>
  );
}

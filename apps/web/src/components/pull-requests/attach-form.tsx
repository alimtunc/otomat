import { Button, Field, FieldControl, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAttachPullRequest } from "@web/api/prs/mutations";
import { fieldErrorProps } from "@web/lib/form";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";
import { useState } from "react";

export function AttachPullRequestForm({ issueId }: { issueId: string }) {
  const attach = useAttachPullRequest(issueId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { reference: "" },
    onSubmit: async ({ value }) => {
      setRefusal(null);
      try {
        await attach.mutateAsync({ reference: value.reference.trim() });
        form.reset();
      } catch (error) {
        setRefusal(
          pullRequestImportRefusal(error) ?? "GitHub could not be reached to verify that number.",
        );
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-start gap-1.5">
        <form.Field
          name="reference"
          validators={{
            onChange: ({ value }) =>
              value.trim().length === 0 ? "Enter a number or a pull request URL." : undefined,
          }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)} className="min-w-0 flex-1">
              <FieldControl>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="#128 or a github.com pull request URL"
                  aria-label="Pull request number or URL"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => [state.canSubmit, state.values.reference] as const}>
          {([canSubmit, reference]) => (
            <Button
              type="submit"
              size="xs"
              variant="outline"
              loading={attach.isPending}
              disabled={!canSubmit || reference.trim().length === 0 || attach.isPending}
            >
              Attach
            </Button>
          )}
        </form.Subscribe>
      </div>
      {refusal === null ? null : (
        <p role="alert" className="m-0 text-xs text-danger">
          {refusal}
        </p>
      )}
    </form>
  );
}

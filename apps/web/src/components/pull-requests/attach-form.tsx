import { Button, Field, FieldControl, FieldLabel, Icon, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAttachPullRequest } from "@web/api/prs/mutations";
import { fieldErrorProps } from "@web/lib/form";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";
import { useState } from "react";

export interface AttachPullRequestFormProps {
  issueId: string;
  onLinked: () => void;
  onCancel: () => void;
}

export function AttachPullRequestForm({ issueId, onLinked, onCancel }: AttachPullRequestFormProps) {
  const attach = useAttachPullRequest(issueId);
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { reference: "" },
    onSubmit: async ({ value }) => {
      setRefusal(null);
      try {
        await attach.mutateAsync({ reference: value.reference.trim() });
        form.reset();
        onLinked();
      } catch (error) {
        setRefusal(
          pullRequestImportRefusal(error) ?? "Could not verify this PR on GitHub. Try again.",
        );
      }
    },
  });

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="reference"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Enter a number or a pull request URL." : undefined,
        }}
      >
        {(field) => (
          <Field
            {...fieldErrorProps(field.state.meta)}
            hint="Use a PR from this issue’s repository."
            className="min-w-0"
          >
            <FieldLabel>PR number or URL</FieldLabel>
            <FieldControl>
              <Input
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="#128 or https://github.com/…"
                readOnly={attach.isPending}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      {refusal === null ? null : (
        <p role="alert" className="m-0 break-words text-xs text-danger">
          {refusal}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={attach.isPending}>
          Cancel
        </Button>
        <form.Subscribe selector={(state) => [state.canSubmit, state.values.reference] as const}>
          {([canSubmit, reference]) => (
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={attach.isPending}
              disabled={!canSubmit || reference.trim().length === 0 || attach.isPending}
            >
              <Icon name="plus" aria-hidden />
              Link pull request
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

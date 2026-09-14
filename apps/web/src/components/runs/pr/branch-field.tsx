import { pullRequestPublicationDetailsSchema } from "@otomat/domain";
import { Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import type { PullRequestFormApi } from "@web/components/runs/pr/use-form";
import { fieldErrorProps } from "@web/lib/form";

export function PullRequestBranchField({
  form,
  disabled,
  branchLocked,
  headRef,
}: {
  form: PullRequestFormApi;
  disabled: boolean;
  branchLocked: boolean;
  headRef: string | null;
}) {
  return (
    <form.Field
      name="branch"
      validators={{
        onChange: ({ value }) => {
          const parsed = pullRequestPublicationDetailsSchema.shape.head_ref.safeParse(
            value.trim() || undefined,
          );
          return parsed.success ? undefined : parsed.error.issues[0]?.message;
        },
      }}
    >
      {(field) => (
        <Field
          {...fieldErrorProps(field.state.meta)}
          hint={
            branchLocked
              ? "The published PR keeps its branch."
              : "Remote branch the PR ships as; empty keeps the run branch."
          }
        >
          <FieldLabel>Branch</FieldLabel>
          <FieldControl>
            <Input
              value={field.state.value}
              disabled={disabled || branchLocked}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder={headRef ?? "feat/short-name"}
              spellCheck={false}
            />
          </FieldControl>
        </Field>
      )}
    </form.Field>
  );
}

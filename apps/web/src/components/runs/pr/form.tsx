import type { PullRequestContract } from "@otomat/domain";
import {
  Button,
  Chip,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  PRStatusBadge,
  Textarea,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { fieldErrorProps } from "@web/lib/form";

interface PullRequestFormProps {
  pullRequest: PullRequestContract | null;
  branch: string | null;
  onSubmit: (value: { title: string; body: string }) => Promise<void>;
  isPending: boolean;
}

export function PullRequestForm({
  pullRequest,
  branch,
  onSubmit,
  isPending,
}: PullRequestFormProps) {
  const form = useForm({
    defaultValues: {
      title: pullRequest?.title ?? "",
      body: pullRequest?.body ?? "",
    },
    onSubmit: async ({ value }) => {
      await onSubmit({ title: value.title.trim(), body: value.body });
    },
  });

  const submitLabel = pullRequest === null ? "Prepare pull request" : "Update draft";

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        {pullRequest ? <PRStatusBadge status={pullRequest.status} /> : null}
        {branch ? <Chip tone="ghost">{branch}</Chip> : null}
        <span className="text-xs text-text-tertiary">
          Local draft only — nothing is sent to GitHub.
        </span>
      </div>
      <form.Field
        name="title"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? "A title is required." : undefined),
        }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Title</FieldLabel>
            <FieldControl>
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Summarize the change…"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Field name="body">
        {(field) => (
          <Field hint="Optional description shown on the future pull request.">
            <FieldLabel>Description</FieldLabel>
            <FieldControl>
              <Textarea
                rows={8}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What changed and why…"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex justify-end">
        <form.Subscribe selector={(state) => [state.canSubmit] as const}>
          {([canSubmit]) => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canSubmit}
              loading={isPending}
            >
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

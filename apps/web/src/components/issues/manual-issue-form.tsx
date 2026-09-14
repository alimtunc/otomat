import type { CreateIssueRequest } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Input, Textarea } from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { useCreateIssueAndNavigate } from "@web/api/issues/mutations";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { useDraftPresence } from "@web/components/issues/use-draft-presence";
import { fieldErrorProps, hasText } from "@web/lib/form";

export interface ManualIssueFormProps {
  projectId: string | undefined;
  onCreated: () => void;
  onCancel: () => void;
  onDraftChange: (hasDraft: boolean) => void;
}

export function ManualIssueForm({
  projectId,
  onCreated,
  onCancel,
  onDraftChange,
}: ManualIssueFormProps) {
  const { create, isPending } = useCreateIssueAndNavigate();
  const form = useForm({
    defaultValues: { title: "", body: "" },
    onSubmit: async ({ value }) => {
      if (!projectId) return;
      const body = value.body.trim();
      const request: CreateIssueRequest = { project_id: projectId, title: value.title.trim() };
      if (body.length > 0) request.body = body;
      const created = await create(request);
      if (created) {
        form.reset();
        onCreated();
      }
    },
  });

  const hasDraft = useStore(
    form.store,
    (state) => hasText(state.values.title) || hasText(state.values.body),
  );
  useDraftPresence(hasDraft, onDraftChange);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <form.Field
          name="title"
          validators={{
            onChange: ({ value }) =>
              value.trim().length === 0 ? "Give the issue a title." : undefined,
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
                  placeholder="Short, actionable summary"
                  aria-label="Issue title"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <form.Field name="body">
          {(field) => (
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldControl>
                <Textarea
                  rows={4}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Optional context, constraints, acceptance criteria"
                  aria-label="Issue description"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        {projectId ? null : (
          <p className="text-xs text-danger">Select a project before creating an issue.</p>
        )}
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe selector={(state) => [state.canSubmit, state.values.title] as const}>
            {([canSubmit, title]) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!canSubmit || title.trim().length === 0 || !projectId || isPending}
              >
                Create issue
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}

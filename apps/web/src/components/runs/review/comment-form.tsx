import { Button, Field, FieldControl, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { fieldErrorProps } from "@web/lib/form";

export interface ReviewCommentFormProps {
  filePath: string;
  line: number;
  onSubmit: (body: string) => Promise<void>;
  onClose: () => void;
}

export function ReviewCommentForm({ filePath, line, onSubmit, onClose }: ReviewCommentFormProps) {
  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: async ({ value }) => {
      await onSubmit(value.body.trim());
      onClose();
    },
  });

  return (
    <form
      className="flex flex-col gap-2 border-y border-border bg-surface-raised p-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="font-mono text-xs text-text-tertiary">
        Comment pinned to {filePath}:{line}
      </p>
      <form.Field
        name="body"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Write a comment before submitting." : undefined,
        }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldControl>
              <Textarea
                autoFocus
                rows={3}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What should change on this line?"
                aria-label="Review comment"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          Cancel
        </Button>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              Comment
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

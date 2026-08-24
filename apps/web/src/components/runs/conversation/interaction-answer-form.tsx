import { Button, Field, FieldControl, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import type { useAnswerRunInteraction } from "@web/api/runs/interaction-mutations";
import { fieldErrorProps } from "@web/lib/form";

export function InteractionAnswerForm({
  answer,
}: {
  answer: ReturnType<typeof useAnswerRunInteraction>;
}) {
  const form = useForm({
    defaultValues: { text: "" },
    onSubmit: ({ value }) => answer.mutate({ kind: "text", text: value.text.trim() }),
  });

  return (
    <form
      aria-label="Answer the agent"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="text"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Write an answer before sending." : undefined,
        }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldControl>
              <Textarea
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  if (answer.isError) answer.reset();
                  field.handleChange(event.target.value);
                }}
                aria-label="Answer the agent"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <Button
            type="submit"
            variant="primary"
            size="xs"
            disabled={!canSubmit || answer.isPending}
            loading={answer.isPending}
            className="self-start"
          >
            Send answer
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

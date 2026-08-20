import { Button, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { usePublishLinearComment } from "@web/api/linear/writeback";
import { hasText } from "@web/lib/form";
import { useState } from "react";

export function Composer({
  issueId,
  runId,
  parentId,
  placeholder,
  onPosted,
}: {
  issueId: string;
  runId: string | null;
  parentId: string | null;
  placeholder: string;
  onPosted?: () => void;
}) {
  const publish = usePublishLinearComment(issueId);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: ({ value }) => {
      publish.mutate(
        {
          client_id: clientId,
          body: value.body.trim(),
          run_id: runId,
          parent_id: parentId,
        },
        {
          onSuccess: () => {
            form.reset();
            setClientId(crypto.randomUUID());
            onPosted?.();
          },
        },
      );
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
      <form.Field name="body">
        {(field) => (
          <Textarea
            rows={2}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="text-sm"
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => hasText(state.values.body)}>
        {(filled) =>
          filled ? (
            <Button
              type="submit"
              size="xs"
              variant="primary"
              className="self-end"
              loading={publish.isPending}
              disabled={publish.isPending}
            >
              {parentId === null ? "Comment" : "Post reply"}
            </Button>
          ) : null
        }
      </form.Subscribe>
    </form>
  );
}

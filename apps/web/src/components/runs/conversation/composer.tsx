import type { RunDetail } from "@otomat/domain";
import { Button, Field, FieldControl, Kbd, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useDaemonStatus, useRuntimes } from "@web/api/daemon/queries";
import { useCreateRunContribution } from "@web/api/runs/mutations";
import { fieldErrorProps } from "@web/lib/form";
import { resolveContributionGate } from "@web/lib/run/contribution";
import type { KeyboardEvent } from "react";

/** Run-scoped composer. It stays usable while the agent works: the message is persisted and queued for the next safe turn. */
export function ConversationComposer({ detail }: { detail: RunDetail }) {
  const contribute = useCreateRunContribution(detail.run.id);
  const { connectionState } = useDaemonStatus();
  const runtimes = useRuntimes();
  const gate = resolveContributionGate(detail, runtimes.data, connectionState);

  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: async ({ value }) => {
      try {
        await contribute.mutateAsync({ body: value.body.trim() });
        form.reset();
      } catch {
        // The mutation's onError toast reports it; the draft stays for retry.
      }
    },
  });

  function submitIfPossible() {
    if (!gate.enabled) return;
    void form.handleSubmit();
  }

  function onBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitIfPossible();
    }
  }

  return (
    <form
      aria-label="Run message"
      className="flex flex-col gap-2 border-t border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitIfPossible();
      }}
    >
      <form.Field
        name="body"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Write a message before sending." : undefined,
        }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldControl>
              <Textarea
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={onBodyKeyDown}
                placeholder="Send a message to this run's agent…"
                aria-label="Run message"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-tertiary">{gate.note}</p>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={!gate.enabled || !canSubmit}
              loading={isSubmitting || contribute.isPending}
            >
              {gate.queues ? "Queue message" : "Send message"}
              <Kbd tone="on-accent">⌘↵</Kbd>
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

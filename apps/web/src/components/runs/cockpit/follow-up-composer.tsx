import type { RunDetail } from "@otomat/domain";
import { Button, Field, FieldControl, Kbd, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useDaemonStatus, useRuntimes } from "@web/api/daemon/queries";
import { useFollowUpRun } from "@web/api/runs/mutations";
import { resolveFollowUpGate } from "@web/lib/follow-up";
import { fieldErrorProps } from "@web/lib/form";
import type { KeyboardEvent } from "react";

export function FollowUpComposer({ detail }: { detail: RunDetail }) {
  const followUp = useFollowUpRun(detail.run.id);
  const { connectionState } = useDaemonStatus();
  const runtimes = useRuntimes();
  const gate = resolveFollowUpGate(detail, runtimes.data, connectionState);

  const form = useForm({
    defaultValues: { prompt: "" },
    onSubmit: async ({ value }) => {
      try {
        await followUp.mutateAsync({ prompt: value.prompt.trim() });
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

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitIfPossible();
    }
  }

  return (
    <form
      aria-label="Run follow-up"
      className="flex flex-col gap-2 border-t border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitIfPossible();
      }}
    >
      <form.Field
        name="prompt"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Write a follow-up before sending." : undefined,
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
                onKeyDown={onPromptKeyDown}
                placeholder="Send a follow-up to this run's agent…"
                aria-label="Follow-up prompt"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-tertiary">
          {gate.reason ?? "Resumes the same agent session as a new turn on this run."}
        </p>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={!gate.enabled || !canSubmit}
              loading={isSubmitting || followUp.isPending}
            >
              Send follow-up
              <Kbd className="border-[rgba(255,255,255,.4)] text-on-accent">⌘↵</Kbd>
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

import type { RunDetail } from "@otomat/domain";
import { Button, Field, FieldControl, Kbd, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useDaemonStatus, useRuntimes } from "@web/api/daemon/queries";
import { useCreateRunContribution } from "@web/api/runs/mutations";
import { participantLabel } from "@web/lib/execution/labels";
import { fieldErrorProps } from "@web/lib/form";
import { contributionErrorMessage, resolveContributionGate } from "@web/lib/run/contribution";
import { stepParticipant } from "@web/lib/run/participant";
import type { KeyboardEvent } from "react";

export function ConversationComposer({
  detail,
  stepRunId: selectedStepRunId,
  onSent,
}: {
  detail: RunDetail;
  stepRunId: string;
  onSent: () => void;
}) {
  const contribute = useCreateRunContribution(detail.run.id);
  const { connectionState } = useDaemonStatus();
  const runtimes = useRuntimes();
  const gate = resolveContributionGate(detail, runtimes.data, connectionState, selectedStepRunId);
  const stepRunId = gate.stepRunId;
  const recipientStep = detail.steps.find((step) => step.id === selectedStepRunId);
  // The identity line outlives the gate: a refused composer still names its recipient.
  const recipient = stepParticipant(detail, selectedStepRunId);

  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: ({ value }) => {
      if (stepRunId === null || gate.targetConfig === null) return;
      contribute.mutate(
        {
          step_run_id: stepRunId,
          target_agent_session_id: gate.targetAgentSessionId,
          target_config_hash: gate.targetConfig.config_hash,
          body: value.body.trim(),
        },
        {
          onSuccess: () => {
            form.reset();
            onSent();
          },
        },
      );
    },
  });

  const submitIfPossible = () => {
    if (stepRunId === null) return;
    void form.handleSubmit();
  };

  const onBodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitIfPossible();
    }
  };

  return (
    <form
      aria-label="Run message"
      className="flex flex-col gap-2 border-t border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitIfPossible();
      }}
    >
      {recipientStep === undefined ? null : (
        <p className="text-xs font-medium text-text-secondary">
          To: {recipientStep.name}
          {recipient.config === null
            ? " · Participant configuration unavailable"
            : ` · ${participantLabel(recipient.config)}`}
          {recipient.session === null ? (
            " · First turn"
          ) : (
            <span title={recipient.session.id}> · Session {recipient.session.id.slice(0, 8)}</span>
          )}
        </p>
      )}
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
                onChange={(event) => {
                  if (contribute.isError) contribute.reset();
                  field.handleChange(event.target.value);
                }}
                onKeyDown={onBodyKeyDown}
                placeholder={
                  gate.stepName === null
                    ? "Send a message to this run's agent…"
                    : `Send a message to ${gate.stepName}…`
                }
                aria-label="Run message"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={contribute.error ? "text-xs text-danger" : "text-xs text-text-tertiary"}>
          {contribute.error ? contributionErrorMessage(contribute.error) : gate.note}
        </p>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={stepRunId === null || !canSubmit || contribute.isPending}
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

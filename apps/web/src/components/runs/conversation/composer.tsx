import type { RunDetail } from "@otomat/domain";
import { Button, Field, FieldControl, Icon, IconButton, Kbd, Textarea } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useDaemonStatus, useRuntimes } from "@web/api/daemon/queries";
import { useCreateRunContribution } from "@web/api/runs/mutations";
import { participantLabel } from "@web/lib/execution/labels";
import {
  acceptComposerImages,
  COMPOSER_IMAGE_ACCEPT,
  composerDraftSendable,
  composerImageFiles,
  composerImageRefusal,
  releaseComposerImages,
  type ComposerImage,
} from "@web/lib/run/composer-images";
import { contributionErrorMessage, resolveContributionGate } from "@web/lib/run/contribution";
import { stepParticipant } from "@web/lib/run/participant";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import { ComposerImages } from "./composer-images";

interface ComposerDraft {
  body: string;
  images: ComposerImage[];
}

const EMPTY_DRAFT: ComposerDraft = { body: "", images: [] };

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
  const attachRefusal = composerImageRefusal(gate.images);
  const [imageRefusal, setImageRefusal] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: EMPTY_DRAFT,
    // The rule spans both fields, so it is the form's to check, not the body's.
    validators: {
      onSubmit: ({ value }) =>
        composerDraftSendable(gate.images, value.body, value.images.length)
          ? undefined
          : "Write a message or attach an image.",
    },
    onSubmit: ({ value }) => {
      if (stepRunId === null || gate.targetConfig === null) return;
      contribute.mutate(
        {
          request: {
            step_run_id: stepRunId,
            target_agent_session_id: gate.targetAgentSessionId,
            target_config_hash: gate.targetConfig.config_hash,
            body: value.body.trim(),
          },
          images: value.images.map((image) => image.file),
        },
        {
          onSuccess: () => {
            releaseComposerImages(value.images);
            form.reset();
            onSent();
          },
        },
      );
    },
  });

  // otomat-allow-effect: an object URL outlives React state, so unmount is the only place to revoke a leaving draft's thumbnails.
  useEffect(() => () => releaseComposerImages(form.getFieldValue("images")), [form]);

  const submitIfPossible = () => {
    if (stepRunId === null) return;
    void form.handleSubmit();
  };

  const addImages = async (files: File[]) => {
    if (files.length === 0 || attachRefusal !== null) return;
    const verdict = await acceptComposerImages(form.getFieldValue("images"), files);
    if (!verdict.ok) {
      setImageRefusal(verdict.message);
      return;
    }
    setImageRefusal(null);
    form.setFieldValue("images", verdict.images);
  };

  const onBodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitIfPossible();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = composerImageFiles(event.clipboardData.files);
    if (files.length === 0) return;
    event.preventDefault();
    void addImages(files);
  };

  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    void addImages(composerImageFiles(event.dataTransfer.files));
  };

  return (
    <form
      aria-label="Run message"
      className="flex flex-col gap-2 border-t border-border-subtle p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitIfPossible();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
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
      <form.Field name="body">
        {(field) => (
          <Field>
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
                onPaste={onPaste}
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
      <form.Field name="images">
        {(field) => (
          <ComposerImages
            images={field.state.value}
            onRemove={(index) => {
              setImageRefusal(null);
              releaseComposerImages(field.state.value.slice(index, index + 1));
              field.removeValue(index);
            }}
          />
        )}
      </form.Field>
      <input
        ref={picker}
        type="file"
        accept={COMPOSER_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          void addImages(composerImageFiles(event.target.files));
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(submitError) => {
            const refusal =
              imageRefusal ??
              submitError ??
              (contribute.error ? contributionErrorMessage(contribute.error) : null);
            return refusal === null ? (
              <p className="text-xs text-text-tertiary">{stepRunId === null ? gate.note : null}</p>
            ) : (
              <p className="text-xs text-danger">{refusal}</p>
            );
          }}
        </form.Subscribe>
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            label="Attach images"
            title={attachRefusal ?? undefined}
            disabled={stepRunId === null || attachRefusal !== null}
            icon={<Icon name="image" aria-hidden />}
            onClick={() => picker.current?.click()}
          />
          <form.Subscribe
            selector={(state) =>
              [state.values.body, state.values.images.length, state.isSubmitting] as const
            }
          >
            {([body, imageCount, isSubmitting]) => (
              <Button
                type="submit"
                variant="primary"
                size="xs"
                disabled={
                  stepRunId === null ||
                  !composerDraftSendable(gate.images, body, imageCount) ||
                  contribute.isPending
                }
                loading={isSubmitting || contribute.isPending}
                title={stepRunId === null ? undefined : gate.note}
              >
                {gate.queues ? "Queue message" : "Send message"}
                <Kbd tone="on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </form>
  );
}

import { interactionAnswerRefusal, type RunInteractionContract } from "@otomat/domain";
import { Button, cn } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import type { useAnswerRunInteraction } from "@web/api/runs/interaction-mutations";
import { InteractionQuestionField } from "@web/components/runs/conversation/interaction/question-field";
import { draftAnswer, initialDrafts, type QuestionDraft } from "@web/lib/run/interaction-answer";

/** Every question the request carries, submitted together: a runtime that asked them as one takes one answer. */
export function InteractionAnswerForm({
  interaction,
  answer,
}: {
  interaction: RunInteractionContract;
  answer: ReturnType<typeof useAnswerRunInteraction>;
}) {
  const submittable = ({ value }: { value: { drafts: QuestionDraft[] } }): string | undefined =>
    interactionAnswerRefusal(interaction, draftAnswer(interaction, value.drafts))?.message;
  const form = useForm({
    defaultValues: { drafts: initialDrafts(interaction.questions) },
    validators: { onMount: submittable, onChange: submittable },
    onSubmit: ({ value }) => answer.mutate(draftAnswer(interaction, value.drafts)),
  });

  return (
    <form
      aria-label="Answer the agent"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {interaction.questions.map((question, index) => {
        const labelId = `${interaction.id}-q${index}`;
        return (
          <div key={labelId} className="flex flex-col gap-1.5">
            <p
              id={labelId}
              className={cn(
                "text-xs font-medium text-text-secondary",
                interaction.questions.length === 1 && "sr-only",
              )}
            >
              {question.prompt}
            </p>
            <form.Field name={`drafts[${index}]`}>
              {(field) => (
                <InteractionQuestionField
                  question={question}
                  draft={field.state.value}
                  labelId={labelId}
                  disabled={answer.isPending}
                  onChange={(next) => {
                    if (answer.isError) answer.reset();
                    field.handleChange(next);
                  }}
                />
              )}
            </form.Field>
          </div>
        );
      })}
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, refusal: state.errors[0] })}
      >
        {({ canSubmit, refusal }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={!canSubmit || answer.isPending}
              loading={answer.isPending}
            >
              Send answer
            </Button>
            {typeof refusal === "string" ? (
              <span className="text-xs text-text-tertiary">{refusal}</span>
            ) : null}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

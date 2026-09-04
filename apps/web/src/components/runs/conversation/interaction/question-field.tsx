import type { RuntimeInteractionQuestion } from "@otomat/domain";
import { Button, Textarea } from "@otomat/ui";
import {
  draftOtherToggled,
  draftToggled,
  type QuestionDraft,
} from "@web/lib/run/interaction-answer";

export function InteractionQuestionField({
  question,
  draft,
  labelId,
  disabled,
  onChange,
}: {
  question: RuntimeInteractionQuestion;
  draft: QuestionDraft;
  labelId: string;
  disabled: boolean;
  onChange: (next: QuestionDraft) => void;
}) {
  const single = question.select === "single";
  const role = single ? "radio" : "checkbox";
  const listed = question.options.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {listed ? (
        <div
          role={single ? "radiogroup" : "group"}
          aria-labelledby={labelId}
          className="flex flex-col gap-1"
        >
          {question.options.map((option) => {
            const checked = draft.values.includes(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                role={role}
                aria-checked={checked}
                variant={checked ? "primary" : "outline"}
                size="xs"
                disabled={disabled}
                className="h-auto justify-start py-1.5 text-left"
                onClick={() => onChange(draftToggled(draft, question, option.value))}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span>{option.label}</span>
                  {option.description === null ? null : (
                    <span className="text-micro font-normal opacity-80">{option.description}</span>
                  )}
                </span>
              </Button>
            );
          })}
          {question.allows_custom ? (
            <Button
              type="button"
              role={role}
              aria-checked={draft.other}
              variant={draft.other ? "primary" : "outline"}
              size="xs"
              disabled={disabled}
              className="justify-start"
              onClick={() => onChange(draftOtherToggled(draft, question))}
            >
              Other
            </Button>
          ) : null}
        </div>
      ) : null}
      {draft.other || !listed ? (
        <Textarea
          rows={2}
          value={draft.custom}
          disabled={disabled}
          aria-labelledby={labelId}
          placeholder="Write your answer"
          onChange={(event) => onChange({ ...draft, custom: event.target.value })}
        />
      ) : null}
    </div>
  );
}

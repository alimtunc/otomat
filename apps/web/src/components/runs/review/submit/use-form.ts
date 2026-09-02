import type { PullRequestReviewEvent, ReviewTarget, SubmitReviewRequest } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useSubmitReview } from "@web/api/reviews/mutations";
import { hasText } from "@web/lib/form";

export interface SubmitReviewFormOptions {
  target: ReviewTarget;
  events: readonly PullRequestReviewEvent[];
  pendingComments: number;
  onSubmitted: () => void;
}

const EMPTY = "Write a summary or leave a comment on the diff before submitting.";

export function useSubmitReviewForm({
  target,
  events,
  pendingComments,
  onSubmitted,
}: SubmitReviewFormOptions) {
  const submit = useSubmitReview(target);
  const defaultValues: SubmitReviewRequest = { body: "", event: events[0] ?? "comment" };
  const submittable = ({ value }: { value: SubmitReviewRequest }): string | undefined =>
    hasText(value.body) || pendingComments > 0 ? undefined : EMPTY;
  const form = useForm({
    defaultValues,
    // `onMount` too: without it TanStack Form reports `canSubmit` until the first change.
    validators: { onMount: submittable, onChange: submittable },
    // A refused submission keeps the composer filled to be retried; the mutation toasts GitHub's reason.
    onSubmit: ({ value }) => {
      submit.mutate(value, {
        onSuccess: () => {
          form.reset();
          onSubmitted();
        },
      });
    },
  });
  return { form, submitting: submit.isPending };
}

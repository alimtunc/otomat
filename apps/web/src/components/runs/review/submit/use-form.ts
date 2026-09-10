import {
  reviewSubmissionRefusal,
  type PullRequestReviewEvent,
  type ReviewTarget,
  type SubmitReviewRequest,
} from "@otomat/domain";
import { useForm, useStore } from "@tanstack/react-form";
import { useSubmitReview } from "@web/api/reviews/mutations";

export interface SubmitReviewFormOptions {
  target: ReviewTarget;
  events: readonly PullRequestReviewEvent[];
  pendingComments: number;
  onSubmitted: () => void;
}

export function useSubmitReviewForm({
  target,
  events,
  pendingComments,
  onSubmitted,
}: SubmitReviewFormOptions) {
  const submit = useSubmitReview(target);
  const defaultValues: SubmitReviewRequest = { body: "", event: events[0] ?? "comment" };
  const submittable = ({ value }: { value: SubmitReviewRequest }): string | undefined =>
    reviewSubmissionRefusal(value.event, { body: value.body, comments: pendingComments }) ??
    undefined;
  const form = useForm({
    defaultValues,
    // `onMount` too: without it TanStack Form reports `canSubmit` until the first change.
    validators: { onMount: submittable, onChange: submittable },
    onSubmit: ({ value }) => {
      submit.mutate(value, {
        onSuccess: () => {
          form.reset();
          onSubmitted();
        },
      });
    },
  });
  const refusal = useStore(form.store, (state) =>
    typeof state.errors[0] === "string" ? state.errors[0] : undefined,
  );
  return { form, refusal, submitting: submit.isPending };
}

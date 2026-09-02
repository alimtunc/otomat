import { isPendingReviewComment, type ReviewDetail, type ReviewTarget } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Icon,
  Textarea,
} from "@otomat/ui";
import { SubmitReviewEventControl } from "@web/components/runs/review/submit/event-control";
import { useSubmitReviewForm } from "@web/components/runs/review/submit/use-form";
import { submitOnCmdEnter } from "@web/lib/form";
import { useState } from "react";

export interface SubmitReviewDialogProps {
  target: ReviewTarget;
  detail: ReviewDetail;
}

export function SubmitReviewDialog({ target, detail }: SubmitReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const pending = detail.comments.filter(isPendingReviewComment);
  const { form, submitting } = useSubmitReviewForm({
    target,
    events: detail.submission.events,
    pendingComments: pending.length,
    onSubmitted: () => setOpen(false),
  });
  const reviewed = detail.reviewed_files.filter((file) => file.reviewed);

  if (detail.submission.events.length === 0) {
    return (
      <Button size="sm" variant="primary" disabled title={detail.submission.reason}>
        <Icon name="git-pull-request" aria-hidden />
        Submit review
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="primary">
            <Icon name="git-pull-request" aria-hidden />
            Submit review
          </Button>
        }
      />
      <DialogContent aria-label="Submit a review to GitHub">
        <DialogHeader>
          <DialogTitle>Submit review</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            {reviewed.length} {reviewed.length === 1 ? "file" : "files"} reviewed · {pending.length}{" "}
            {pending.length === 1 ? "comment" : "comments"} included. GitHub takes the summary, the
            verdict and every comment as one review.
          </p>
          <form.Field name="body">
            {(field) => (
              <Field>
                <FieldLabel>Summary</FieldLabel>
                <Textarea
                  aria-label="Review summary"
                  rows={5}
                  value={field.state.value}
                  placeholder="Optional — what the author should know before reading the comments."
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  onKeyDown={submitOnCmdEnter(() => {
                    if (!submitting) void form.handleSubmit();
                  })}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="event">
            {(field) => (
              <SubmitReviewEventControl
                value={field.state.value}
                events={detail.submission.events}
                reason={detail.submission.reason}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, refusal: state.errors[0] })}
          >
            {({ canSubmit, refusal }) => (
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={submitting}
                disabled={submitting || !canSubmit}
                title={typeof refusal === "string" ? refusal : undefined}
                onClick={() => void form.handleSubmit()}
              >
                Submit to GitHub
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

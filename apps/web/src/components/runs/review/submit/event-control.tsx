import {
  isPullRequestReviewEvent,
  PULL_REQUEST_REVIEW_EVENTS,
  type PullRequestReviewEvent,
} from "@otomat/domain";
import { Field, FieldLabel, SegmentedControl, SegmentedItem } from "@otomat/ui";

const EVENT_LABEL = {
  comment: "Comment",
  request_changes: "Request changes",
  approve: "Approve",
} satisfies Record<PullRequestReviewEvent, string>;

export interface SubmitReviewEventControlProps {
  value: PullRequestReviewEvent;
  events: readonly PullRequestReviewEvent[];
  reason: string;
  onChange: (event: PullRequestReviewEvent) => void;
}

export function SubmitReviewEventControl({
  value,
  events,
  reason,
  onChange,
}: SubmitReviewEventControlProps) {
  const withheld = PULL_REQUEST_REVIEW_EVENTS.filter((event) => !events.includes(event));
  return (
    <Field hint={withheld.length === 0 ? undefined : reason}>
      <FieldLabel>Verdict</FieldLabel>
      <SegmentedControl
        type="single"
        value={value}
        onValueChange={(next) => {
          if (isPullRequestReviewEvent(next)) onChange(next);
        }}
        aria-label="Review verdict"
      >
        {events.map((event) => (
          <SegmentedItem key={event} value={event}>
            {EVENT_LABEL[event]}
          </SegmentedItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}

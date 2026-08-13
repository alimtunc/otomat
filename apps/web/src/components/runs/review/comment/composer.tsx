import type {
  DiffFileContract,
  DiffSide,
  ReviewCommentDestination,
  ReviewDestinationAvailability,
} from "@otomat/domain";
import { Button, Icon, SegmentedControl, SegmentedItem, Textarea } from "@otomat/ui";
import { CommentDestinationControl } from "@web/components/runs/review/comment/destination-control";
import { CommentRangeControl } from "@web/components/runs/review/comment/range-control";
import {
  useCommentComposer,
  type ComposedComment,
} from "@web/components/runs/review/comment/use-composer";

export interface ReviewCommentComposerProps {
  file: DiffFileContract;
  side: DiffSide;
  /** Last line of the anchor; null composes on the whole file. */
  line: number | null;
  fromLine: number | null;
  destinations: ReviewDestinationAvailability;
  preferredDestination: ReviewCommentDestination;
  onSubmit: (comment: ComposedComment) => Promise<void>;
  onClose: () => void;
}

export function ReviewCommentComposer({
  file,
  side,
  line,
  fromLine,
  destinations,
  preferredDestination,
  onSubmit,
  onClose,
}: ReviewCommentComposerProps) {
  const composer = useCommentComposer({
    patch: file.patch,
    side,
    line,
    fromLine,
    prReview: { available: destinations.pr_review, reason: destinations.reason },
    preferredDestination,
    onSubmit,
    onClose,
  });
  const { form, mode, range, suggestionBlocked, destination } = composer;

  return (
    <form
      className="flex flex-col gap-2 border-y border-border bg-surface-raised p-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <CommentRangeControl
        filePath={file.path}
        side={side}
        range={range}
        onMoveEdge={composer.moveEdge}
      />
      <SegmentedControl
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (value === "comment" || value === "suggest") form.setFieldValue("mode", value);
        }}
        aria-label="Comment kind"
      >
        <SegmentedItem value="comment" icon={<Icon name="message-square" />}>
          Comment
        </SegmentedItem>
        <SegmentedItem
          value="suggest"
          icon={<Icon name="wand-2" />}
          disabled={suggestionBlocked !== null}
        >
          Suggest change
        </SegmentedItem>
      </SegmentedControl>
      {mode === "suggest" && suggestionBlocked !== null ? (
        <p className="text-xs text-warning">{suggestionBlocked}</p>
      ) : null}
      {mode === "suggest" && suggestionBlocked === null ? (
        <form.Field name="suggestion">
          {(field) => (
            <Textarea
              rows={Math.min(12, field.state.value.split("\n").length + 1)}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-label="Suggested replacement"
              className="font-mono"
            />
          )}
        </form.Field>
      ) : null}
      <form.Field name="body">
        {(field) => (
          <Textarea
            autoFocus
            rows={3}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={
              range === null
                ? "What should change in this file?"
                : "What should change on these lines?"
            }
            aria-label="Review comment"
          />
        )}
      </form.Field>
      <CommentDestinationControl
        destination={destination}
        onChange={(next) => form.setFieldValue("destination", next)}
        unavailableReason={destinations.pr_review ? null : destinations.reason}
        fellBack={composer.destinationFellBack}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          Cancel
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              variant="primary"
              size="xs"
              disabled={!composer.canSubmit}
              loading={submitting}
            >
              {destination === "pr_review" ? "Comment on the PR" : "Add comment"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

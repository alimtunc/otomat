import {
  readRangeLines,
  suggestionRefusal,
  type CreateReviewCommentRequest,
  type DiffSide,
  type PatchRange,
  type ReviewCommentDestination,
} from "@otomat/domain";
import { useForm, useStore } from "@tanstack/react-form";
import { hasText } from "@web/lib/form";

type CommentComposerMode = "comment" | "suggest";

interface CommentRange {
  start: number;
  end: number;
}

interface CommentComposerValues {
  mode: CommentComposerMode;
  destination: ReviewCommentDestination;
  body: string;
  /** null tracks the range's head lines; a string is the reviewer's own replacement. */
  suggestion: string | null;
}

/** What the composer hands back: a comment request minus the anchor its file already fixes. */
export type ComposedComment = Omit<CreateReviewCommentRequest, "file_path" | "diff_sha">;

export interface CommentComposerOptions {
  patch: string;
  side: DiffSide;
  line: number | null;
  fromLine: number | null;
  prReview: { available: boolean; reason: string };
  preferredDestination: ReviewCommentDestination;
  onSubmit: (comment: ComposedComment) => Promise<void>;
  onClose: () => void;
}

const WHOLE_FILE_REFUSAL = "A suggestion replaces lines, so a whole-file note cannot carry one.";

/** Owns what the reviewer is composing; the range stays the gutter's, so both always read the same lines. */
export function useCommentComposer(options: CommentComposerOptions) {
  const { patch, side, prReview, preferredDestination } = options;
  const range: CommentRange | null =
    options.line === null ? null : { start: options.fromLine ?? options.line, end: options.line };

  const patchRange = (lines: CommentRange): PatchRange => ({
    side,
    startLine: lines.start,
    endLine: lines.end,
  });
  const refusal = (lines: CommentRange | null): string | null =>
    lines === null ? WHOLE_FILE_REFUSAL : suggestionRefusal(patch, patchRange(lines));
  const headLines = (lines: CommentRange | null): string =>
    lines === null ? "" : (readRangeLines(patch, patchRange(lines)) ?? []).join("\n");
  const reachable = (destination: ReviewCommentDestination): ReviewCommentDestination =>
    destination === "pr_review" && !prReview.available ? "agent" : destination;

  const prefill = headLines(range);

  const compose = (values: CommentComposerValues): ComposedComment => {
    const replacement = values.suggestion ?? prefill;
    const suggesting =
      values.mode === "suggest" && refusal(range) === null && replacement !== prefill;
    return {
      side,
      start_line: range === null || range.start === range.end ? null : range.start,
      line: range?.end ?? null,
      body: values.body,
      destination: reachable(values.destination),
      suggestion: suggesting ? replacement : null,
    };
  };

  const defaultValues: CommentComposerValues = {
    mode: "comment",
    destination: reachable(preferredDestination),
    body: "",
    suggestion: null,
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      try {
        await options.onSubmit(compose(value));
      } catch {
        // The mutation toasts the refusal; staying open is what the reviewer acts on.
        return;
      }
      options.onClose();
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const request = compose(values);

  return {
    form,
    range,
    mode: values.mode,
    suggestionPrefill: prefill,
    suggestionBlocked: refusal(range),
    destination: request.destination,
    /** True when the preferred destination is unavailable and Agent stands in for it. */
    destinationFellBack: reachable(preferredDestination) !== preferredDestination,
    canSubmit: hasText(values.body) || request.suggestion !== null,
  };
}

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
  range: CommentRange | null;
  mode: CommentComposerMode;
  destination: ReviewCommentDestination;
  body: string;
  suggestion: string;
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

/** Owns what the reviewer is composing; the anchor it was opened on seeds it and never fights it afterwards. */
export function useCommentComposer(options: CommentComposerOptions) {
  const { patch, side, prReview, preferredDestination } = options;

  const patchRange = (range: CommentRange): PatchRange => ({
    side,
    startLine: range.start,
    endLine: range.end,
  });
  const refusal = (range: CommentRange | null): string | null =>
    range === null ? WHOLE_FILE_REFUSAL : suggestionRefusal(patch, patchRange(range));
  const headLines = (range: CommentRange | null): string =>
    range === null ? "" : (readRangeLines(patch, patchRange(range)) ?? []).join("\n");
  const reachable = (destination: ReviewCommentDestination): ReviewCommentDestination =>
    destination === "pr_review" && !prReview.available ? "agent" : destination;

  const compose = (values: CommentComposerValues): ComposedComment => {
    const suggesting =
      values.mode === "suggest" &&
      refusal(values.range) === null &&
      values.suggestion !== headLines(values.range);
    const range = values.range;
    return {
      side,
      start_line: range === null || range.start === range.end ? null : range.start,
      line: range?.end ?? null,
      body: values.body,
      destination: reachable(values.destination),
      suggestion: suggesting ? values.suggestion : null,
    };
  };

  const anchor =
    options.line === null ? null : { start: options.fromLine ?? options.line, end: options.line };
  const defaultValues: CommentComposerValues = {
    range: anchor,
    mode: "comment",
    destination: reachable(preferredDestination),
    body: "",
    suggestion: headLines(anchor),
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
    range: values.range,
    mode: values.mode,
    moveEdge: (edge: "start" | "end", by: 1 | -1): void => {
      const current = form.getFieldValue("range");
      if (current === null) return;
      const next = { ...current, [edge]: current[edge] + by };
      if (next.start < 1 || next.start > next.end) return;
      const prefilled = form.getFieldValue("suggestion") === headLines(current);
      form.setFieldValue("range", next);
      if (prefilled) form.setFieldValue("suggestion", headLines(next));
    },
    suggestionBlocked: refusal(values.range),
    destination: request.destination,
    /** True when the preferred destination is unavailable and Agent stands in for it. */
    destinationFellBack: reachable(preferredDestination) !== preferredDestination,
    canSubmit: hasText(values.body) || request.suggestion !== null,
  };
}

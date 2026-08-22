import type {
  DiffFileContract,
  ReviewCommentContract,
  ReviewCommentDestination,
  ReviewDestinationAvailability,
} from "@otomat/domain";

import type { ComposedComment } from "./comment/use-composer";
import { EMPTY_FILE_COMMENT_COUNTS, type FileCommentCounts } from "./file-comment-counts";
import type { PartitionedComments } from "./partition";

/** Everything one file card knows about its own feedback, gathered once by the diff view. */
export interface DiffFileComments {
  byLine: Map<number, ReviewCommentContract[]>;
  whole: ReviewCommentContract[];
  all: readonly ReviewCommentContract[];
  counts: FileCommentCounts;
  anchoredIds: ReadonlySet<string>;
  destinations: ReviewDestinationAvailability;
  preferredDestination: ReviewCommentDestination;
  publishingId: string | null;
}

export interface DiffFileCommentActions {
  add: (file: DiffFileContract, comment: ComposedComment) => Promise<void>;
  publish: (commentId: string) => void;
  reveal: (comment: ReviewCommentContract) => void;
}

const NO_LINE_COMMENTS = new Map<number, ReviewCommentContract[]>();
const NO_COMMENTS: ReviewCommentContract[] = [];

export interface FileCommentsInput {
  partition: PartitionedComments;
  destinations: ReviewDestinationAvailability;
  preferredDestination: ReviewCommentDestination;
  publishingId: string | null;
}

export function fileComments(path: string, input: FileCommentsInput): DiffFileComments {
  const { partition } = input;
  return {
    byLine: partition.byLine.get(path) ?? NO_LINE_COMMENTS,
    whole: partition.byFile.get(path) ?? NO_COMMENTS,
    all: partition.byPath.get(path) ?? NO_COMMENTS,
    counts: partition.countsByPath.get(path) ?? EMPTY_FILE_COMMENT_COUNTS,
    anchoredIds: partition.anchoredIds,
    destinations: input.destinations,
    preferredDestination: input.preferredDestination,
    publishingId: input.publishingId,
  };
}

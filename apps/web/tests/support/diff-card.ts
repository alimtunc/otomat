import { WORKSPACE_DIFF_SCOPE } from "@otomat/domain";
import type { DiffFileCardProps } from "@web/components/runs/diff/files/card";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import type {
  DiffFileCommentActions,
  DiffFileComments,
} from "@web/components/runs/review/file-comments";

import { diffFile } from "#support/diff-file";

export function fileCommentsProp(overrides: Partial<DiffFileComments> = {}): DiffFileComments {
  return {
    byLine: new Map(),
    whole: [],
    all: [],
    counts: { open: 0, addressed: 0, agent: 0, prReview: 0, stale: 0 },
    anchoredIds: new Set(),
    selectedIds: new Set(),
    destinations: { pr_review: false, reason: "This run has no pull request yet." },
    preferredDestination: "agent",
    publishingId: null,
    ...overrides,
  };
}

export function fileCommentActions(
  overrides: Partial<DiffFileCommentActions> = {},
): DiffFileCommentActions {
  return {
    add: async () => {},
    toggle: () => {},
    publish: () => {},
    reveal: () => {},
    ...overrides,
  };
}

export function diffFileCardProps(overrides: Partial<DiffFileCardProps> = {}): DiffFileCardProps {
  return {
    target: { kind: "run", id: "run-1" },
    scope: WORKSPACE_DIFF_SCOPE,
    file: diffFile({ path: "src/index.ts" }),
    prefs: DEFAULT_DIFF_PREFS,
    reviewed: false,
    onReviewedChange: () => {},
    unsyncedMark: null,
    onRetrySync: () => {},
    collapsed: false,
    onCollapsedChange: () => {},
    active: false,
    onActivate: () => {},
    comments: fileCommentsProp(),
    commentActions: fileCommentActions(),
    ...overrides,
  };
}

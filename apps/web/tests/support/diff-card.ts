import type { DiffFileCardProps } from "@web/components/runs/diff/files/card";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";

import { diffFile } from "#support/diff-file";

export function diffFileCardProps(overrides: Partial<DiffFileCardProps> = {}): DiffFileCardProps {
  return {
    runId: "run-1",
    file: diffFile({ path: "src/index.ts" }),
    prefs: DEFAULT_DIFF_PREFS,
    reviewed: false,
    onReviewedChange: () => {},
    collapsed: false,
    onCollapsedChange: () => {},
    active: false,
    onActivate: () => {},
    commentsByLine: new Map(),
    fileComments: [],
    onAddComment: async () => {},
    selectedCommentIds: new Set(),
    onToggleComment: () => {},
    ...overrides,
  };
}

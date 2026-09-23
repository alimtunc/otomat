import type { CheckoutTarget } from "@otomat/domain";

export const FILE_TREE_WIDTH = 264;

export const EDITOR_PLACEHOLDER_LINES = 14;

interface FilesSurface {
  layout: string;
  panel: string;
  file: string;
  label: string;
  empty: string;
}

export const FILES_SURFACE = {
  run: {
    layout: "otomat.run-files",
    panel: "run-files",
    file: "file",
    label: "Worktree files",
    empty: "Pick a file in the tree to read it, or edit it in place when the worktree is live.",
  },
  repository: {
    layout: "otomat.project-files",
    panel: "project-files",
    file: "project-file",
    label: "Project files",
    empty: "Choose a file, or press ⌘P / Ctrl+P to find it.",
  },
} satisfies Record<CheckoutTarget["kind"], FilesSurface>;

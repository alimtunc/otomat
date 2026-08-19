import type { ChangeStatus } from "@otomat/domain";

export const STATUS_LETTER = {
  added: { letter: "A", className: "text-success" },
  modified: { letter: "M", className: "text-warning" },
  deleted: { letter: "D", className: "text-danger" },
  renamed: { letter: "R", className: "text-iris-text" },
  copied: { letter: "C", className: "text-iris-text" },
  type_changed: { letter: "T", className: "text-text-tertiary" },
} satisfies Record<ChangeStatus, { letter: string; className: string }>;

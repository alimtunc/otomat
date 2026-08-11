import type { LinearWriteState } from "@otomat/domain";

export const WRITE_STATUS_TEXT: Record<LinearWriteState, string> = {
  pending: "text-text-tertiary",
  sending: "text-iris-text",
  sent: "text-success",
  failed: "text-danger",
};

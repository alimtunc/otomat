import type { LinearIssueRelation } from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

export const RELATION_GROUPS = [
  { type: "blocked_by", label: "Blocked by", tone: "warning" },
  { type: "blocks", label: "Blocks", tone: "danger" },
  { type: "related", label: "Related", tone: null },
] as const satisfies ReadonlyArray<{
  type: LinearIssueRelation["type"];
  label: string;
  tone: StatusTone | null;
}>;

export const INVERSE_RELATION_LABEL = {
  blocked_by: "Blocks",
  blocks: "Blocked by",
  related: "Related to",
} as const satisfies Record<LinearIssueRelation["type"], string>;

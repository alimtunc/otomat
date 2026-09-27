import type { LinearIssueNeighbor } from "@otomat/domain";

import { IssueNeighbor } from "./neighbor";

export function IssueParent({ parent }: { parent: LinearIssueNeighbor | null }) {
  if (parent === null) return null;
  return (
    <nav aria-label="Parent issue" className="@container -ml-2">
      <span className="px-2 text-xs text-text-tertiary">Sub-issue of</span>
      <IssueNeighbor issue={parent} />
    </nav>
  );
}

import { EmptyState } from "@otomat/ui";
import { GitCompare } from "lucide-react";

export function RunDiffView() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={GitCompare}
        title="No changes yet"
        description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
      />
    </div>
  );
}

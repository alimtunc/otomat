import { useRequestFix } from "@web/api/reviews/mutations";
import { useState } from "react";

export interface ReviewSelection {
  selectedIds: ReadonlySet<string>;
  toggle: (commentId: string, selected: boolean) => void;
  submitFix: () => void;
  isFixPending: boolean;
}

/** Owns which open comments are selected and the fix-turn request that consumes them. */
export function useReviewSelection(runId: string): ReviewSelection {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const requestFix = useRequestFix(runId);

  function toggle(commentId: string, selected: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
  }

  function submitFix(): void {
    requestFix.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) });
  }

  return { selectedIds, toggle, submitFix, isFixPending: requestFix.isPending };
}

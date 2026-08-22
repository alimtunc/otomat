import type { AppendedRunStepResponse, RequestFixRequest } from "@otomat/domain";
import { useRequestFix } from "@web/api/reviews/mutations";
import { useState } from "react";

export interface ReviewSelection {
  runId: string;
  selectedIds: ReadonlySet<string>;
  toggle: (commentId: string, selected: boolean) => void;
  clear: () => void;
  /** Appends the fix step with the agent the caller picked; clears the selection once the daemon accepts it. */
  requestFix: (
    request: RequestFixRequest,
    onAppended: (response: AppendedRunStepResponse) => void,
  ) => void;
  isFixPending: boolean;
}

/** Owns which open comments are selected and the fix step that consumes them. */
export function useReviewSelection(runId: string): ReviewSelection {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const fix = useRequestFix(runId);

  const toggle = (commentId: string, selected: boolean): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
  };

  const clear = (): void => {
    setSelectedIds(new Set());
  };

  return {
    runId,
    selectedIds,
    toggle,
    clear,
    requestFix: (request, onAppended) =>
      fix.mutate(request, {
        onSuccess: (response) => {
          setSelectedIds(new Set());
          onAppended(response);
        },
      }),
    isFixPending: fix.isPending,
  };
}

import { runDiffScopeParams, type RunDiffScopeSelector } from "@otomat/domain";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toDiffScopeSelector } from "@web/components/runs/diff/scope/search";

export interface DiffScopeState {
  selector: RunDiffScopeSelector;
  select: (next: RunDiffScopeSelector) => void;
}

/** The scope lives in the URL, so a shared link opens on the same slice and Back returns to the previous one. */
export function useDiffScope(): DiffScopeState {
  const search = useSearch({ from: "/runs/$runId/diff" });
  const navigate = useNavigate({ from: "/runs/$runId/diff" });
  return {
    selector: toDiffScopeSelector(search),
    select: (next) => {
      void navigate({
        // The file anchor belongs to the scope that named it, not to the next one.
        search: (prev) => ({ ...prev, file: undefined, ...runDiffScopeParams(next) }),
      });
    },
  };
}

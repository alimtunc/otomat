import { useNavigate, useSearch } from "@tanstack/react-router";

export interface ActiveDiffFile {
  path: string | null;
  select: (path: string) => void;
}

/**
 * Route-agnostic: both diff routes (`/runs/$runId/diff`, `/pull-requests/$pullRequestId/diff`)
 * declare the `file` search param. Selection replaces the history entry: reading a diff must
 * not bury the page the reviewer came from, and `resetScroll: false` keeps the router from
 * re-applying the previous file's offset over the reveal that selection asked for.
 */
export function useActiveDiffFile(): ActiveDiffFile {
  const navigate = useNavigate();
  const { file } = useSearch({ strict: false });
  const path = file ?? null;

  return {
    path,
    select: (next: string) => {
      if (next === path) return;
      void navigate({
        to: ".",
        search: (previous) => ({ ...previous, file: next }),
        replace: true,
        resetScroll: false,
      });
    },
  };
}

import { useNavigate, useSearch } from "@tanstack/react-router";

export interface ActiveDiffFile {
  path: string | null;
  select: (path: string) => void;
}

/** Selection replaces the history entry: reading a diff must not bury the page the reviewer came from. */
export function useActiveDiffFile(runId: string): ActiveDiffFile {
  const navigate = useNavigate();
  const { file } = useSearch({ from: "/runs/$runId/diff" });
  const path = file ?? null;

  return {
    path,
    select: (next: string) => {
      if (next === path) return;
      void navigate({
        to: "/runs/$runId/diff",
        params: { runId },
        search: { file: next },
        replace: true,
      });
    },
  };
}

import { useNavigate, useSearch } from "@tanstack/react-router";

export interface ActiveDiffFile {
  path: string | null;
  select: (path: string) => void;
}

/** `resetScroll: false` keeps the router from re-applying the previous file's offset over the reveal. */
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

import { useState } from "react";

export interface CollapsedFiles {
  has: (path: string) => boolean;
  set: (path: string, collapsed: boolean) => void;
}

/** Collapse is per file and purely a reading state: it never touches Reviewed or a comment. */
export function useCollapsedFiles(): CollapsedFiles {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());

  return {
    has: (path) => collapsed.has(path),
    set: (path, next) => {
      setCollapsed((current) => {
        const updated = new Set(current);
        if (next) updated.add(path);
        else updated.delete(path);
        return updated;
      });
    },
  };
}

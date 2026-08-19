import type { DiffFileContract } from "@otomat/domain";
import { useState } from "react";

export interface CollapsedFiles {
  has: (path: string) => boolean;
  set: (path: string, collapsed: boolean) => void;
}

/** Keyed by sha so an override dies with the patch it was made against. */
interface CollapseOverride {
  sha: string;
  collapsed: boolean;
}

export function useCollapsedFiles(
  files: readonly DiffFileContract[],
  reviewedPaths: ReadonlySet<string>,
): CollapsedFiles {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, CollapseOverride>>(
    () => new Map(),
  );
  const shas = new Map(files.map((file) => [file.path, file.sha]));

  return {
    has: (path) => {
      const override = overrides.get(path);
      if (override !== undefined && override.sha === shas.get(path)) return override.collapsed;
      return reviewedPaths.has(path);
    },
    set: (path, collapsed) => {
      const sha = shas.get(path);
      if (sha === undefined) return;
      setOverrides((current) => new Map(current).set(path, { sha, collapsed }));
    },
  };
}

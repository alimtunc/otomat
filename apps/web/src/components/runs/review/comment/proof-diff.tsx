import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import type { DiffFileContract } from "@otomat/domain";
import { useTheme } from "@otomat/ui";
import { diffViewData, unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import type { FileBlobsContext } from "@web/components/runs/diff/files/use-file-blobs";
import { useMemo } from "react";

export interface ProofDiffProps {
  file: DiffFileContract;
  patch: string;
  context: FileBlobsContext | null;
}

export function ProofDiff({ file, patch, context }: ProofDiffProps) {
  const { theme } = useTheme();
  const data = useMemo(
    () => diffViewData(file, patch, context),
    [file.path, file.old_path, patch, context],
  );

  const note = unrenderableNote(file);
  if (note !== null) return <p className="px-3 py-2 text-xs text-text-tertiary">{note}</p>;

  return (
    <div className="otomat-review-diff overflow-hidden rounded-sm border border-border-subtle">
      <DiffView
        data={data}
        diffViewMode={DiffModeEnum.Unified}
        diffViewTheme={theme}
        diffViewHighlight
        diffViewWrap
        diffViewFontSize={12}
      />
    </div>
  );
}

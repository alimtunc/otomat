import { DiffModeEnum, DiffViewWithMultiSelect } from "@git-diff-view/react";
import {
  changeSupportsSelection,
  type ChangeSelection,
  type DiffFileContract,
  type SourceControlAction,
} from "@otomat/domain";
import { useTheme } from "@otomat/ui";
import { diffViewData } from "@web/components/runs/diff/files/card.utils";
import { ChangeActions } from "@web/components/source-control/change-actions";
import { useMemo, useState } from "react";

export interface ChangeBlockProps {
  file: DiffFileContract;
  patch: string;
  index: number;
  staged: boolean;
  pending: boolean;
  onAction: (action: SourceControlAction, selection: ChangeSelection) => void;
}

export function ChangeBlock({ file, patch, index, staged, pending, onAction }: ChangeBlockProps) {
  const { theme } = useTheme();
  const [selection, setSelection] = useState<ChangeSelection | null>(null);
  const selectable = changeSupportsSelection(file);
  // DiffView rebuilds its file on `data` identity; a fresh object per render would re-highlight on every selection.
  const data = useMemo(() => diffViewData(file, patch, null), [file.path, file.old_path, patch]);
  return (
    <section className="border-b border-border-subtle" aria-label={`Change block ${index + 1}`}>
      {selectable ? (
        <div className="flex flex-wrap items-center gap-2 bg-surface-2 px-3 py-1.5 text-xs">
          <span className="mr-auto text-text-tertiary">Block {index + 1}</span>
          {selection === null ? null : (
            <ChangeActions
              staged={staged}
              pending={pending}
              subject="selection"
              onAction={(action) => onAction(action, selection)}
            />
          )}
          <ChangeActions
            staged={staged}
            pending={pending}
            subject="block"
            onAction={(action) => onAction(action, { kind: "hunk", index })}
          />
        </div>
      ) : null}
      <div className="otomat-review-diff overflow-auto">
        <DiffViewWithMultiSelect
          data={data}
          diffViewMode={DiffModeEnum.Unified}
          diffViewTheme={theme}
          diffViewHighlight
          diffViewFontSize={12}
          enableMultiSelect={selectable}
          onMultiSelectComplete={({ range }) =>
            setSelection({
              kind: "lines",
              side: range.side,
              start: range.startLineNumber,
              end: range.endLineNumber,
            })
          }
        />
      </div>
    </section>
  );
}

import { DiffModeEnum, DiffViewWithMultiSelect } from "@git-diff-view/react";
import type { ChangeSelection, DiffFileContract, SourceControlAction } from "@otomat/domain";
import { Button, useTheme } from "@otomat/ui";
import { diffViewData } from "@web/components/runs/diff/files/card.utils";
import { useState } from "react";

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
  const selectable = file.status === "modified" && file.old_path === null;
  const action = staged ? "unstage" : "stage";
  return (
    <section className="border-b border-border-subtle" aria-label={`Change block ${index + 1}`}>
      {selectable ? (
        <div className="flex flex-wrap items-center gap-2 bg-surface-2 px-3 py-1.5 text-xs">
          <span className="mr-auto text-text-tertiary">Block {index + 1}</span>
          {selection !== null ? (
            <>
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => onAction(action, selection)}
              >
                {staged ? "Unstage selection" : "Stage selection"}
              </Button>
              {!staged ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onAction("discard", selection)}
                >
                  Discard selection
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => onAction(action, { kind: "hunk", index })}
          >
            {staged ? "Unstage block" : "Stage block"}
          </Button>
          {!staged ? (
            <Button
              size="xs"
              variant="ghost"
              disabled={pending}
              onClick={() => onAction("discard", { kind: "hunk", index })}
            >
              Discard block
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="otomat-review-diff overflow-auto">
        <DiffViewWithMultiSelect
          data={diffViewData(file, patch, null)}
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

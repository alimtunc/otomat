import type { DiffFileContract } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import {
  classifyDiffFile,
  groupDiffFiles,
  type DiffFileType,
} from "@web/components/runs/diff/files/group";
import { DiffFileList } from "@web/components/runs/diff/files/list";
import { ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";
import { DiffFileTree } from "@web/components/runs/diff/files/tree";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";
import { DiffStat } from "@web/components/runs/diff/stat";
import { useMemo, useState } from "react";

export interface DiffFileGroupListProps {
  files: readonly DiffFileContract[];
  mode: DiffBrowserMode;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

export function DiffFileGroupList({
  files,
  mode,
  activePath,
  reviewedPaths,
  onSelect,
}: DiffFileGroupListProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<DiffFileType>>(
    () => new Set<DiffFileType>(),
  );
  const [revealed, setRevealed] = useState(activePath);
  const groups = useMemo(() => groupDiffFiles(files), [files]);

  if (revealed !== activePath) {
    setRevealed(activePath);
    if (activePath !== null) {
      const holding = classifyDiffFile(activePath);
      if (collapsed.has(holding)) {
        const next = new Set(collapsed);
        next.delete(holding);
        setCollapsed(next);
      }
    }
  }

  const toggle = (type: DiffFileType): void => {
    const next = new Set(collapsed);
    if (!next.delete(type)) next.add(type);
    setCollapsed(next);
  };

  return (
    <div className="py-1">
      {groups.map((group) => {
        const expanded = !collapsed.has(group.type);
        const rows = { files: group.files, activePath, reviewedPaths, onSelect };
        const body = mode === "tree" ? <DiffFileTree {...rows} /> : <DiffFileList {...rows} />;
        return (
          <section key={group.type}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => toggle(group.type)}
              style={{ paddingLeft: `${ROW_PADDING_REM}rem` }}
              className="h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-medium text-foreground hover:bg-hover"
            >
              <Icon
                name={expanded ? "chevron-down" : "chevron-right"}
                className="h-3 w-3 shrink-0 text-text-tertiary"
              />
              <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
              <span className="shrink-0 font-mono text-micro tabular-nums text-text-tertiary">
                {group.files.length}
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-micro tabular-nums">
                <DiffStat additions={group.additions} deletions={group.deletions} />
              </span>
            </Button>
            {expanded ? body : null}
          </section>
        );
      })}
    </div>
  );
}

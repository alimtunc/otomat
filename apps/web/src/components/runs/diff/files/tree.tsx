import type { DiffFileContract } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffFileRow } from "@web/components/runs/diff/files/row";
import { INDENT_REM, ROW_PADDING_REM } from "@web/components/runs/diff/files/row.utils";
import {
  buildDiffFileTree,
  expandAncestors,
  visibleTreeRows,
} from "@web/components/runs/diff/files/tree.utils";
import { useMemo, useState } from "react";

export interface DiffFileTreeProps {
  files: readonly DiffFileContract[];
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

/** Tree mode: real folders, foldable, with single-child folder runs shown as one row. */
export function DiffFileTree({ files, activePath, reviewedPaths, onSelect }: DiffFileTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [revealed, setRevealed] = useState(activePath);
  const nodes = useMemo(() => buildDiffFileTree(files), [files]);

  // Arriving at a file reopens the folders hiding it; collapsing stays the reader's decision,
  // so the chevron cannot report a state the rows contradict.
  if (revealed !== activePath) {
    setRevealed(activePath);
    if (activePath !== null) setCollapsed(expandAncestors(collapsed, activePath));
  }

  const rows = visibleTreeRows(nodes, collapsed);

  function toggle(path: string): void {
    const next = new Set(collapsed);
    if (!next.delete(path)) next.add(path);
    setCollapsed(next);
  }

  return (
    <ul className="py-1">
      {rows.map(({ node, depth, expanded }) => {
        if (node.kind === "file") {
          return (
            <li key={node.file.path}>
              <DiffFileRow
                file={node.file}
                active={node.file.path === activePath}
                reviewed={reviewedPaths.has(node.file.path)}
                detail={diffFileLabels(node.file).move ?? ""}
                indent={depth}
                onSelect={onSelect}
              />
            </li>
          );
        }
        return (
          <li key={`folder:${node.path}`}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={node.path}
              aria-expanded={expanded}
              onClick={() => toggle(node.path)}
              style={{ paddingLeft: `${ROW_PADDING_REM + depth * INDENT_REM}rem` }}
              className="h-7 w-full justify-start gap-1.5 rounded-none pr-3 text-xs font-normal text-text-secondary hover:bg-hover"
            >
              <Icon
                name={expanded ? "chevron-down" : "chevron-right"}
                className="h-3 w-3 shrink-0 text-text-tertiary"
              />
              <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

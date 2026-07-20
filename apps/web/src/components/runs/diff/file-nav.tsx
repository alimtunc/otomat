import type { DiffFileContract, RunDiffContract } from "@otomat/domain";
import {
  Icon,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { adjacentFile } from "@web/components/runs/diff/diff-nav";
import { STATUS_LETTER } from "@web/components/runs/diff/file-tree.utils";

/** Compact single-row replacement for the file tree on narrow diff widths. */
export function DiffFileNav({
  diff,
  activePath,
  reviewedPaths,
  onSelect,
}: {
  diff: RunDiffContract;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}) {
  const files = diff.files;
  const index = files.findIndex((file) => file.path === activePath);
  const previous = adjacentFile(files, activePath, -1);
  const next = adjacentFile(files, activePath, 1);
  const items = files.map((file) => ({
    value: file.path,
    label: `${STATUS_LETTER[file.status].letter} ${file.path}${reviewedPaths.has(file.path) ? " ✓" : ""}`,
  }));

  function selectPath(path: string | null): void {
    const file = files.find((entry) => entry.path === path);
    if (file !== undefined) onSelect(file);
  }

  return (
    <div className="flex flex-none items-center gap-2 border-b border-border-subtle px-3.5 py-2">
      <IconButton
        label="Previous file"
        icon={<Icon name="arrow-up" />}
        disabled={previous === null}
        onClick={() => selectPath(previous?.path ?? null)}
      />
      <IconButton
        label="Next file"
        icon={<Icon name="arrow-down" />}
        disabled={next === null}
        onClick={() => selectPath(next?.path ?? null)}
      />
      <Select items={items} value={activePath} onValueChange={selectPath}>
        <SelectTrigger aria-label="Jump to file" className="min-w-0 flex-1 font-mono text-xs">
          <SelectValue placeholder="Jump to a changed file" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} className="font-mono text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
        {index === -1 ? "–" : index + 1}/{files.length}
      </span>
    </div>
  );
}

import type { WorktreeFileEntry } from "@otomat/domain";
import { Icon, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { FileTree } from "@web/components/runs/diff/files/file-tree";
import { WorktreeFileRow } from "@web/components/runs/files/row";

export interface WorktreeFileBrowserProps {
  entries: readonly WorktreeFileEntry[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

export function WorktreeFileBrowser({ entries, activePath, onSelect }: WorktreeFileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  return (
    <form.Field name="query">
      {(field) => {
        const needle = field.state.value.trim().toLowerCase();
        const matched =
          needle === ""
            ? entries
            : entries.filter((entry) => entry.path.toLowerCase().includes(needle));
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border-subtle px-2.5 py-2">
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                icon={<Icon name="search" aria-hidden />}
                placeholder="Filter by path"
                aria-label="Filter worktree files"
                className="h-7 text-xs"
              />
            </div>
            <nav aria-label="Worktree files" className="min-h-0 flex-1 overflow-auto">
              {matched.length === 0 ? (
                <p className="px-3 py-4 text-xs text-text-tertiary">
                  {entries.length === 0 ? "This worktree is empty." : "No file matches."}
                </p>
              ) : (
                // A filtered tree remounts with every folder open: a match hidden under a fold reads as no match.
                <FileTree
                  key={needle}
                  files={matched}
                  activePath={activePath}
                  collapsedByDefault={needle === ""}
                  renderFile={(entry, depth) => (
                    <WorktreeFileRow
                      entry={entry}
                      active={entry.path === activePath}
                      indent={depth}
                      onSelect={onSelect}
                    />
                  )}
                />
              )}
            </nav>
          </div>
        );
      }}
    </form.Field>
  );
}

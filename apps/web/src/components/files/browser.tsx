import type { SourceControlResponse, WorktreeFileEntry } from "@otomat/domain";
import { Icon, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { decorateFiles } from "@web/components/files/decorations";
import { FileBrowserRow } from "@web/components/files/row";
import { FileTree } from "@web/components/runs/diff/files/file-tree";
import { useMemo } from "react";

export interface FileBrowserProps {
  entries: readonly WorktreeFileEntry[];
  activePath: string | null;
  onSelect: (path: string, changes?: boolean) => void;
  scope?: string;
  changes?: SourceControlResponse;
}

export function FileBrowser({ entries, activePath, onSelect, scope, changes }: FileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  const decorated = useMemo(() => decorateFiles(entries, changes), [entries, changes]);
  return (
    <form.Field name="query">
      {(field) => {
        const needle = field.state.value.trim().toLowerCase();
        const matched =
          needle === ""
            ? decorated.files
            : decorated.files.filter((entry) => entry.path.toLowerCase().includes(needle));
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border-subtle px-2.5 py-2">
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                icon={<Icon name="search" aria-hidden />}
                placeholder="Filter by path"
                aria-label="Filter files"
                className="h-7 text-xs"
              />
            </div>
            <nav aria-label="Files" className="min-h-0 flex-1 overflow-auto">
              {matched.length === 0 ? (
                <p className="px-3 py-4 text-xs text-text-tertiary">
                  {entries.length === 0 ? "This checkout is empty." : "No file matches."}
                </p>
              ) : (
                <FileTree
                  key={needle}
                  files={matched}
                  activePath={activePath}
                  directoryStatuses={decorated.directories}
                  collapsedByDefault={needle === ""}
                  storageKey={
                    scope === undefined || needle !== ""
                      ? undefined
                      : `otomat.files.folders:${scope}`
                  }
                  renderFile={(entry, depth) => (
                    <FileBrowserRow
                      entry={entry}
                      active={entry.path === activePath}
                      indent={depth}
                      onSelect={(path) => onSelect(path, entry.status === "deleted")}
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

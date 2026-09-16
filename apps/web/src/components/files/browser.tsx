import type {
  CheckoutTarget,
  CreateWorktreeEntryRequest,
  SourceControlResponse,
  WorktreeFileEntry,
} from "@otomat/domain";
import { Icon, IconButton, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { FilesActions } from "@web/components/files/actions";
import { CreateEntryRow } from "@web/components/files/create-entry-row";
import { decorateFiles } from "@web/components/files/decorations";
import { FileBrowserRow } from "@web/components/files/row";
import { FileTree } from "@web/components/files/tree/file-tree";
import type { FileTreeHandle } from "@web/components/files/tree/utils";
import { useMemo, useRef, useState } from "react";

export interface FileBrowserProps {
  entries: readonly WorktreeFileEntry[];
  activePath: string | null;
  onSelect: (path: string, openInChanges?: boolean) => void;
  scope?: string;
  changes?: SourceControlResponse;
  actions?: {
    target: CheckoutTarget;
    editable: boolean;
    refreshing: boolean;
    onRefresh: () => void;
  };
}

export function FileBrowser({
  entries,
  activePath,
  onSelect,
  scope,
  changes,
  actions,
}: FileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  const tree = useRef<FileTreeHandle>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [directory, setDirectory] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    kind: CreateWorktreeEntryRequest["kind"];
    directory: string;
  } | null>(null);
  const [openedFile, setOpenedFile] = useState(activePath);
  if (openedFile !== activePath) {
    setOpenedFile(activePath);
    setDirectory(null);
    setCreating(null);
  }
  const decorated = useMemo(() => decorateFiles(entries, changes), [entries, changes]);
  return (
    <form.Field name="query">
      {(field) => {
        const needle = field.state.value.trim().toLowerCase();
        const matched =
          needle === ""
            ? decorated.files
            : decorated.files.filter((entry) => entry.path.toLowerCase().includes(needle));
        const hasFolders = matched.some(
          (entry) => entry.kind === "directory" || entry.path.includes("/"),
        );
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={toolbar} className="flex items-center gap-0.5 px-2 py-1">
              <span className="mr-auto truncate text-xs text-text-secondary">Explorer</span>
              {actions === undefined ? null : (
                <FilesActions
                  {...actions}
                  onCreate={(kind) => {
                    field.handleChange("");
                    setCreating({
                      kind,
                      directory: directory ?? activePath?.split("/").slice(0, -1).join("/") ?? "",
                    });
                  }}
                />
              )}
              <IconButton
                label="Collapse / expand all folders"
                icon={<Icon name="copy-minus" aria-hidden />}
                disabled={!hasFolders}
                onClick={() => {
                  setCreating(null);
                  tree.current?.toggleAll();
                }}
              />
            </div>
            <div className="border-b border-border-subtle px-2.5 pb-2">
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                disabled={creating !== null}
                icon={<Icon name="search" aria-hidden />}
                placeholder="Filter by path"
                aria-label="Filter files"
                className="h-7 min-w-0 text-xs"
              />
            </div>
            <nav aria-label="Files" className="min-h-0 flex-1 overflow-auto">
              {matched.length === 0 && creating === null ? (
                <p className="px-3 py-4 text-xs text-text-tertiary">
                  {entries.length === 0 ? "This checkout is empty." : "No file matches."}
                </p>
              ) : (
                // A filtered tree remounts with every folder open: a match hidden under a fold reads as no match.
                <FileTree
                  key={needle}
                  ref={tree}
                  files={matched}
                  activePath={activePath}
                  selectedDirectory={directory}
                  onSelectDirectory={(path) => {
                    setCreating(null);
                    setDirectory(path);
                  }}
                  insertion={
                    creating === null || actions === undefined
                      ? undefined
                      : {
                          directory: creating.directory,
                          render: (depth) => (
                            <CreateEntryRow
                              key={`${creating.kind}:${creating.directory}`}
                              target={actions.target}
                              {...creating}
                              entries={entries}
                              depth={depth}
                              onCancel={() => {
                                setCreating(null);
                                toolbar.current
                                  ?.querySelector<HTMLButtonElement>(
                                    `button[aria-label="New ${creating.kind === "file" ? "file" : "folder"}"]`,
                                  )
                                  ?.focus();
                              }}
                              onCreated={(entry) => {
                                setCreating(null);
                                setDirectory(entry.kind === "directory" ? entry.path : null);
                                if (entry.kind === "file") onSelect(entry.path);
                              }}
                            />
                          ),
                        }
                  }
                  directoryStatuses={decorated.directories}
                  collapsedByDefault={needle === ""}
                  storageScope={needle === "" ? scope : undefined}
                  renderFile={(entry, depth) => (
                    <FileBrowserRow
                      entry={entry}
                      active={directory === null && entry.path === activePath}
                      indent={depth}
                      onSelect={(path) => {
                        setCreating(null);
                        setDirectory(null);
                        onSelect(path, entry.status === "deleted");
                      }}
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

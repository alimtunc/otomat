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
import { directoryName } from "@web/components/files/tree/path";
import type { FileTreeHandle } from "@web/components/files/tree/utils";
import { useMemo, useRef, useState } from "react";

export interface FileBrowserProps {
  target: CheckoutTarget;
  editable: boolean;
  entries: readonly WorktreeFileEntry[];
  activePath: string | null;
  onSelect: (path: string, openInChanges?: boolean) => void;
  onCreated: (entry: WorktreeFileEntry) => void;
  scope?: string;
  changes?: SourceControlResponse;
}

export function FileBrowser({
  target,
  editable,
  entries,
  activePath,
  onSelect,
  onCreated,
  scope,
  changes,
}: FileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  const tree = useRef<FileTreeHandle>(null);
  const [directory, setDirectory] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    kind: CreateWorktreeEntryRequest["kind"];
    directory: string;
    opener: HTMLButtonElement;
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
            <div className="flex items-center gap-0.5 px-2 py-1">
              <span className="mr-auto truncate text-xs text-text-secondary">Explorer</span>
              <FilesActions
                target={target}
                editable={editable}
                onCreate={(kind, opener) => {
                  field.handleChange("");
                  setCreating({
                    kind,
                    directory: directory ?? (activePath === null ? "" : directoryName(activePath)),
                    opener,
                  });
                }}
              />
              <IconButton
                label="Collapse / expand all folders"
                icon={<Icon name="copy-minus" aria-hidden />}
                disabled={!hasFolders || creating !== null}
                onClick={() => tree.current?.toggleAll()}
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
                    creating === null
                      ? undefined
                      : {
                          directory: creating.directory,
                          row: (
                            <CreateEntryRow
                              key={`${creating.kind}:${creating.directory}`}
                              target={target}
                              kind={creating.kind}
                              directory={creating.directory}
                              entries={entries}
                              onCancel={() => {
                                setCreating(null);
                                creating.opener.focus();
                              }}
                              onCreated={(entry) => {
                                setCreating(null);
                                setDirectory(entry.kind === "directory" ? entry.path : null);
                                onCreated(entry);
                                if (entry.kind === "file") onSelect(entry.path);
                              }}
                              onExisting={(path) => {
                                setCreating(null);
                                setDirectory(null);
                                onSelect(path);
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

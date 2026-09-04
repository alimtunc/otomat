import type { DiffFileContract } from "@otomat/domain";
import { Icon, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { DiffFileGroupList } from "@web/components/runs/diff/files/group-list";
import { DiffFileList } from "@web/components/runs/diff/files/list";
import { DiffFileTree } from "@web/components/runs/diff/files/tree";
import type { DiffBrowserMode, DiffGroupingMode } from "@web/components/runs/diff/prefs/prefs";
import type { ReactNode } from "react";

export interface DiffFileBrowserProps {
  files: readonly DiffFileContract[];
  mode: DiffBrowserMode;
  grouping: DiffGroupingMode;
  activePath: string | null;
  reviewedPaths: ReadonlySet<string>;
  onSelect: (file: DiffFileContract) => void;
}

function matchesFile(file: DiffFileContract, needle: string): boolean {
  return (
    file.path.toLowerCase().includes(needle) ||
    (file.old_path !== null && file.old_path.toLowerCase().includes(needle))
  );
}

export function DiffFileBrowser({
  files,
  mode,
  grouping,
  activePath,
  reviewedPaths,
  onSelect,
}: DiffFileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  return (
    <form.Field name="query">
      {(field) => {
        const needle = field.state.value.trim().toLowerCase();
        const matched = needle === "" ? files : files.filter((file) => matchesFile(file, needle));
        const rowProps = { files: matched, activePath, reviewedPaths, onSelect };
        let content: ReactNode;
        if (matched.length === 0) {
          content = (
            <p className="px-3 py-4 text-xs text-text-tertiary">No changed file matches.</p>
          );
        } else if (grouping === "type") {
          content = <DiffFileGroupList mode={mode} {...rowProps} />;
        } else if (mode === "tree") {
          content = <DiffFileTree {...rowProps} />;
        } else {
          content = <DiffFileList {...rowProps} />;
        }
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border-subtle px-2.5 py-2">
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                icon={<Icon name="search" aria-hidden />}
                placeholder="Filter files"
                aria-label="Filter changed files"
                className="h-7 text-xs"
              />
            </div>
            <nav aria-label="Changed files" className="min-h-0 flex-1 overflow-auto">
              {content}
            </nav>
          </div>
        );
      }}
    </form.Field>
  );
}

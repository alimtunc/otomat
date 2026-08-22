import type { DiffFileContract, ReviewDiffContract } from "@otomat/domain";
import { Icon, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { DiffFileList } from "@web/components/runs/diff/files/list";
import { DiffFileTree } from "@web/components/runs/diff/files/tree";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";
import type { ReactNode } from "react";

export interface DiffFileBrowserProps {
  diff: ReviewDiffContract;
  mode: DiffBrowserMode;
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
  diff,
  mode,
  activePath,
  reviewedPaths,
  onSelect,
}: DiffFileBrowserProps) {
  const form = useForm({ defaultValues: { query: "" } });
  return (
    <form.Field name="query">
      {(field) => {
        const needle = field.state.value.trim().toLowerCase();
        const files =
          needle === "" ? diff.files : diff.files.filter((file) => matchesFile(file, needle));
        const rowProps = { files, activePath, reviewedPaths, onSelect };
        let content: ReactNode;
        if (files.length === 0) {
          content = (
            <p className="px-3 py-4 text-xs text-text-tertiary">No changed file matches.</p>
          );
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

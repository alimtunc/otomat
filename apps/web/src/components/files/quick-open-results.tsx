import type { CheckoutTarget, WorktreeFileEntry } from "@otomat/domain";
import { CommandPalette, ErrorState, Spinner } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { searchFiles } from "@web/components/files/search";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export interface QuickOpenResultsProps {
  target: CheckoutTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickOpenResults({ target, open, onOpenChange }: QuickOpenResultsProps) {
  const keys = useQueryKeys();
  const navigate = useNavigate();
  const form = useForm({ defaultValues: { search: "" } });
  const files = useQuery<{ entries: WorktreeFileEntry[] }>({
    queryKey:
      target?.kind === "run" ? keys.runFiles(target.id) : keys.repositoryTree(target?.id ?? null),
    queryFn:
      target === null
        ? skipToken
        : () =>
            target.kind === "run"
              ? daemon.getRunFiles(target.id)
              : daemon.getRepositoryTree(target.id),
    enabled: open,
    retry: retryTransportOnly,
  });
  const select = (path: string): void => {
    if (target === null) return;
    const fileScope = `${keys.host[0]}:${target.kind}:${target.id}`;
    if (target.kind === "run")
      void navigate({
        to: "/runs/$runId/files",
        params: { runId: target.id },
        search: { file: path, fileScope, changes: undefined },
      });
    else void navigate({ to: "/files", search: { file: path, fileScope, changes: undefined } });
  };

  return (
    <form.Field name="search">
      {(field) => (
        <CommandPalette
          open={open}
          onOpenChange={onOpenChange}
          search={field.state.value}
          onSearchChange={field.handleChange}
          placeholder="Find a file by name or path…"
          groups={[
            {
              id: "files",
              heading: target?.kind === "run" ? "Worktree files" : "Project files",
              notice:
                target === null ? (
                  <p className="px-3 py-2 text-xs text-text-secondary">
                    No workspace available in this context.
                  </p>
                ) : (
                  <QueryBoundary
                    query={files}
                    pending={<Spinner label="Loading files" />}
                    error={
                      <ErrorState
                        variant="inline"
                        title="Could not load files"
                        onRetry={() => void files.refetch()}
                      />
                    }
                  >
                    {() =>
                      searchFiles(files.data?.entries ?? [], field.state.value).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-text-secondary">No matching file.</p>
                      ) : null
                    }
                  </QueryBoundary>
                ),
              commands: searchFiles(files.data?.entries ?? [], field.state.value).map((entry) => ({
                id: entry.path,
                label: entry.path,
                icon: "file-text",
                onSelect: () => select(entry.path),
              })),
            },
          ]}
        />
      )}
    </form.Field>
  );
}

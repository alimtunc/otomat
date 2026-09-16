import type { CheckoutTarget } from "@otomat/domain";
import { CommandPalette, ErrorState, Spinner } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useCheckoutFiles } from "@web/api/files/queries";
import { fileScope } from "@web/components/files/scope";
import { searchFiles } from "@web/components/files/search";
import { FILES_SURFACE } from "@web/components/files/surface";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useActiveHostId } from "@web/lib/active-host";

export interface QuickOpenResultsProps {
  target: CheckoutTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickOpenResults({ target, open, onOpenChange }: QuickOpenResultsProps) {
  const host = useActiveHostId();
  const navigate = useNavigate();
  const form = useForm({ defaultValues: { search: "" } });
  const files = useCheckoutFiles(target, open);
  const select = (path: string): void => {
    if (target === null) return;
    const search = { file: path, fileScope: fileScope(host, target) };
    if (target.kind === "run")
      void navigate({ to: "/runs/$runId/files", params: { runId: target.id }, search });
    else void navigate({ to: "/files", search });
  };

  return (
    <form.Field name="search">
      {(field) => {
        const matches = searchFiles(files.data?.entries ?? [], field.state.value);
        return (
          <CommandPalette
            open={open}
            onOpenChange={onOpenChange}
            search={field.state.value}
            onSearchChange={field.handleChange}
            placeholder="Find a file by name or path…"
            groups={[
              {
                id: "files",
                heading: FILES_SURFACE[target?.kind ?? "repository"].label,
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
                        matches.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-text-secondary">No matching file.</p>
                        ) : null
                      }
                    </QueryBoundary>
                  ),
                commands: matches.map((entry) => ({
                  id: entry.path,
                  label: entry.path,
                  icon: "file-text",
                  onSelect: () => select(entry.path),
                })),
              },
            ]}
          />
        );
      }}
    </form.Field>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { RunFilesView } from "@web/components/runs/files/view";

export const Route = createFileRoute("/runs/$runId/files")({
  validateSearch: (search: Record<string, unknown>) => ({
    changes: search.changes === true || search.changes === "true" ? true : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
    fileScope: typeof search.fileScope === "string" ? search.fileScope : undefined,
  }),
  /** Fetches the editor chunk while the tree loads, so the first file opens without a second wait. */
  loader: () => void import("@web/components/files/code-editor"),
  component: RunFilesView,
});

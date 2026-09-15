import { createFileRoute } from "@tanstack/react-router";
import { RunFilesView } from "@web/components/runs/files/view";

export const Route = createFileRoute("/runs/$runId/files")({
  validateSearch: (search: Record<string, unknown>): { file?: string } =>
    typeof search.file === "string" ? { file: search.file } : {},
  /** Fetches the editor chunk while the tree loads, so the first file opens without a second wait. */
  loader: () => void import("@web/components/runs/files/code-editor"),
  component: RunFilesView,
});

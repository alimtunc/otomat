import { createFileRoute } from "@tanstack/react-router";
import { parseFilesSearch } from "@web/components/files/search-params";
import { RunFilesView } from "@web/components/runs/files/view";

export const Route = createFileRoute("/runs/$runId/files")({
  validateSearch: parseFilesSearch,
  /** Fetches the editor chunk while the tree loads, so the first file opens without a second wait. */
  loader: () => void import("@web/components/files/code-editor"),
  component: RunFilesView,
});

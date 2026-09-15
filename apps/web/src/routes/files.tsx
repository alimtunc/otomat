import { createFileRoute } from "@tanstack/react-router";
import { ProjectFilesView } from "@web/components/files/project/view";

export const Route = createFileRoute("/files")({
  validateSearch: (search: Record<string, unknown>) => ({
    changes: search.changes === true || search.changes === "true" ? true : undefined,
    file: typeof search.file === "string" ? search.file : undefined,
    fileScope: typeof search.fileScope === "string" ? search.fileScope : undefined,
  }),
  loader: () => void import("@web/components/files/code-editor"),
  component: ProjectFilesView,
});

import { createFileRoute } from "@tanstack/react-router";
import { ProjectFilesView } from "@web/components/files/project/view";
import { parseFilesSearch } from "@web/components/files/search-params";

export const Route = createFileRoute("/files")({
  validateSearch: parseFilesSearch,
  loader: () => void import("@web/components/files/code-editor"),
  component: ProjectFilesView,
});

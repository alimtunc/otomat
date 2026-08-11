import { createFileRoute } from "@tanstack/react-router";
import { RunDiffView } from "@web/components/runs/diff/view";

export const Route = createFileRoute("/runs/$runId/diff")({
  /** Optional so every existing link to the reviewer stays valid without naming a file. */
  validateSearch: (search: Record<string, unknown>): { file?: string } => ({
    file: typeof search.file === "string" ? search.file : undefined,
  }),
  component: RunDiffView,
});

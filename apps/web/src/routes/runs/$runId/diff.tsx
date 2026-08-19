import { createFileRoute } from "@tanstack/react-router";
import { readDiffScopeSearch, type DiffScopeSearch } from "@web/components/runs/diff/scope/search";
import { RunDiffView } from "@web/components/runs/diff/view";

export const Route = createFileRoute("/runs/$runId/diff")({
  /** Optional so every existing link to the reviewer stays valid without naming a file or a scope. */
  validateSearch: (search: Record<string, unknown>): { file?: string } & DiffScopeSearch => {
    const parsed: { file?: string } & DiffScopeSearch = { ...readDiffScopeSearch(search) };
    if (typeof search.file === "string") parsed.file = search.file;
    return parsed;
  },
  component: RunDiffView,
});

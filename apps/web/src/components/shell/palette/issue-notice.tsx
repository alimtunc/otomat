import type { IssueContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { QueryBoundary } from "@web/components/shell/query-boundary";

const LINE = "px-2.5 py-1.5 text-xs text-text-tertiary";

function summary(scope: string, query: string, shown: number, matches: number): string | null {
  if (matches === 0 && query === "") return `No issue loaded in ${scope} yet.`;
  if (matches === 0) return `No loaded issue in ${scope} matches “${query}”.`;
  if (shown === matches) return null;
  if (query === "") return `Showing ${shown} of ${matches} issues — type to search.`;
  return `Showing ${shown} of ${matches} matches — refine your search.`;
}

export interface PaletteIssueNoticeProps {
  scope: string | undefined;
  query: string;
  issues: UseQueryResult<IssueContract[]>;
  shown: number;
  matches: number;
}

export function PaletteIssueNotice({
  scope,
  query,
  issues,
  shown,
  matches,
}: PaletteIssueNoticeProps) {
  if (scope === undefined) return <p className={LINE}>Select a project to search its issues.</p>;
  const text = summary(scope, query, shown, matches);
  return (
    <QueryBoundary
      query={issues}
      pending={<p className={LINE}>Loading issues in {scope}…</p>}
      error={
        <div className={`${LINE} flex items-center justify-between gap-2`}>
          <span>Couldn’t load issues in {scope}.</span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            loading={issues.isFetching}
            onClick={() => void issues.refetch()}
          >
            Retry
          </Button>
        </div>
      }
    >
      {() => (text === null ? null : <p className={LINE}>{text}</p>)}
    </QueryBoundary>
  );
}

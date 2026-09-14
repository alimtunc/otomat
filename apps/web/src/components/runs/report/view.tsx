import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  Icon,
  IconButton,
  Skeleton,
} from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunCompletionReport } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { DeliverySections } from "./delivery-sections";
import { ExecutionSections } from "./execution-sections";
import { ReportMessages } from "./messages";
import { ReportSummary } from "./summary";

export function RunCompletionReportView() {
  const { runId } = useParams({ from: "/runs/$runId/report" });
  const query = useRunCompletionReport(runId);
  return (
    <QueryBoundary
      query={query}
      pending={<Skeleton height={120} />}
      error={
        <CenteredState>
          <ErrorState
            title="Could not load the completion report"
            description="The daemon could not regenerate this report from persisted evidence."
            onRetry={() => void query.refetch()}
          />
        </CenteredState>
      }
    >
      {({ report, markdown }) => (
        <div className="h-full overflow-auto bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Completion report</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Built from recorded run evidence.{" "}
                  <Icon name="file-text" size="xs" aria-hidden className="inline" /> opens the
                  source for each fact.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <IconButton
                      label="Report actions"
                      icon={<Icon name="more-horizontal" aria-hidden />}
                    />
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    render={
                      <a
                        href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
                        download={`run-${report.run.id}-completion.md`}
                        aria-label="Export Markdown"
                      />
                    }
                  >
                    Export Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <ReportSummary report={report} />
            <div data-report-grid className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ExecutionSections report={report} />
              <DeliverySections report={report} />
            </div>
            <ReportMessages report={report} />
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

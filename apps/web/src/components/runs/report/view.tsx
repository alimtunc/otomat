import { Button, ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunCompletionReport } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";

import { DeliverySections } from "./delivery-sections";
import { ExecutionSections } from "./execution-sections";
import { ReportMessages } from "./messages";
import { ReportSummary } from "./summary";

export function RunCompletionReportView() {
  const { runId } = useParams({ from: "/runs/$runId/report" });
  const query = useRunCompletionReport(runId);
  if (query.isPending) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton height={24} width="32%" />
        <Skeleton height={120} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <CenteredState>
        <ErrorState
          title="Could not load the completion report"
          description="The daemon could not regenerate this report from persisted evidence."
          onRetry={() => void query.refetch()}
        />
      </CenteredState>
    );
  }

  const { report, markdown } = query.data;
  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-iris-text">
              Persisted evidence
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Completion report</h1>
            <p className="mt-1 text-sm text-text-secondary">
              A deterministic projection. No AI-authored narrative.
            </p>
          </div>
          <Button
            variant="primary"
            render={
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
                download={`run-${report.run.id}-completion.md`}
                aria-label="Export completion report as Markdown"
              />
            }
          >
            Export Markdown
          </Button>
        </header>
        <ReportSummary report={report} />
        <div data-report-grid className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ExecutionSections report={report} />
          <DeliverySections report={report} />
        </div>
        <ReportMessages report={report} />
      </div>
    </div>
  );
}

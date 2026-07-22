import type { RunCompletionReport } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";

import { FactEvidence } from "./section";
import { sentence } from "./sentence";

export function ReportSummary({ report }: { report: RunCompletionReport }) {
  const stepCount = report.plan.step_count;
  const stepSummary =
    stepCount === null ? "Plan not reported" : `${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-semibold tracking-tight">
            {sentence(report.run.outcome)}
          </span>
          <RunStatusChip status={report.run.status} />
          <FactEvidence report={report} evidence={report.run.evidence[0]} />
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {report.run.terminal ? "Terminal persisted state" : "Current persisted state"} ·{" "}
          {stepSummary}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs sm:min-w-64">
        <dt className="text-text-tertiary">branch</dt>
        <dd className="min-w-0 truncate text-right font-mono">{report.run.branch}</dd>
        <dt className="text-text-tertiary">report</dt>
        <dd className="text-right font-mono">v{report.version} · deterministic</dd>
      </dl>
    </section>
  );
}

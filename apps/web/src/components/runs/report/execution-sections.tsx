import type { RunCompletionReport } from "@otomat/domain";

import { FactEvidence, ReportSection } from "./section";
import { sentence } from "./sentence";

function Steps({ report }: { report: RunCompletionReport }) {
  if (report.steps.length === 0) {
    return <p className="text-sm text-text-tertiary">No persisted step was reported.</p>;
  }
  return (
    <ol className="space-y-2">
      {report.steps.map((step, index) => (
        <li
          key={step.id}
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-2 border-b border-border-subtle pb-2 last:border-0 last:pb-0"
        >
          <span className="font-mono text-xs text-text-tertiary">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{step.name}</p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {sentence(step.status)} · runtime {step.runtime ?? "not reported"} · session{" "}
              {step.provider_sessions.join(", ") || "not reported"}
            </p>
          </div>
          <FactEvidence report={report} evidence={step.evidence[0]} />
        </li>
      ))}
    </ol>
  );
}

function Commands({ report }: { report: RunCompletionReport }) {
  if (report.commands.length === 0) {
    return <p className="text-sm text-text-tertiary">No command or test was reported.</p>;
  }
  return (
    <ul className="space-y-2">
      {report.commands.map((command) => (
        <li key={command.id} className="flex min-w-0 items-start gap-2">
          <code className="min-w-0 flex-1 break-words text-xs">{command.command}</code>
          <span
            className={
              command.outcome === "failed" ? "text-xs text-danger" : "text-xs text-text-secondary"
            }
          >
            {sentence(command.outcome)}
            {command.exit_code === null ? "" : ` · ${command.exit_code}`}
          </span>
          <FactEvidence report={report} evidence={command.evidence[0]} />
        </li>
      ))}
    </ul>
  );
}

export function ExecutionSections({ report }: { report: RunCompletionReport }) {
  return (
    <>
      <ReportSection title="Steps & runtimes">
        <Steps report={report} />
      </ReportSection>
      <ReportSection title="Commands & tests">
        <Commands report={report} />
      </ReportSection>
    </>
  );
}

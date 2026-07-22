import type { CompletionEvidence, RunCompletionReport } from "@otomat/domain";
import { EvidenceLink } from "@web/components/runs/report/evidence-link";
import type { ReactNode } from "react";

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1">
      <h2 className="border-b border-border-subtle px-4 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FactEvidence({
  report,
  evidence,
  label,
}: {
  report: RunCompletionReport;
  evidence: CompletionEvidence | undefined;
  label?: string;
}) {
  if (!evidence) return null;
  return (
    <EvidenceLink
      runId={report.run.id}
      issueId={report.run.issue_id}
      evidence={evidence}
      label={label}
    />
  );
}

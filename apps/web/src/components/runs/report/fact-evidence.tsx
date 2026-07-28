import type { CompletionEvidence, RunCompletionReport } from "@otomat/domain";
import { EvidenceLink } from "@web/components/runs/report/evidence-link";

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

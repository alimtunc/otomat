import type { CompletionEvidence } from "@otomat/domain";

import { evidenceHref } from "./evidence-href";

export function EvidenceLink({
  runId,
  issueId,
  evidence,
  label,
}: {
  runId: string;
  issueId: string;
  evidence: CompletionEvidence;
  label?: string;
}) {
  const external = evidence.source === "pull_request" && evidence.url !== null;
  return (
    <a
      href={evidenceHref(runId, issueId, evidence)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={`Open ${evidence.source.replace("_", " ")} evidence`}
      className="inline-flex h-5 items-center rounded-sm border border-border px-1.5 font-mono text-micro font-medium uppercase tracking-[0.04em] text-text-tertiary hover:border-border-strong hover:text-text-secondary"
    >
      {label ?? "Evidence"}
    </a>
  );
}

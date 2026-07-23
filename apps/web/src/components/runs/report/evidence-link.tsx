import type { CompletionEvidence } from "@otomat/domain";

function evidenceHref(runId: string, issueId: string, evidence: CompletionEvidence): string {
  const encodedRun = encodeURIComponent(runId);
  switch (evidence.source) {
    case "timeline":
      return `/runs/${encodedRun}${evidence.seq === null ? "" : `#event-${evidence.seq}`}`;
    case "diff":
      return `/runs/${encodedRun}/diff${
        evidence.file_path === null ? "" : `#diff-file-${encodeURIComponent(evidence.file_path)}`
      }`;
    case "review":
      return `/runs/${encodedRun}/diff${
        evidence.comment_id === null ? "" : `#review-comment-${evidence.comment_id}`
      }`;
    case "pull_request":
      return evidence.url ?? `/runs/${encodedRun}/pr`;
    case "linear":
      return `/issues/${encodeURIComponent(issueId)}#linear-write-${evidence.write_id}`;
  }
}

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
      className="inline-flex h-5 items-center rounded-sm border border-iris/25 bg-iris-bg px-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-iris-text hover:border-iris/50"
    >
      {label ?? "Evidence"}
    </a>
  );
}

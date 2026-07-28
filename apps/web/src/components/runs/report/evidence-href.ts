import type { CompletionEvidence } from "@otomat/domain";

export function evidenceHref(runId: string, issueId: string, evidence: CompletionEvidence): string {
  const encodedRun = encodeURIComponent(runId);
  switch (evidence.source) {
    case "timeline":
      return evidence.seq === null
        ? `/runs/${encodedRun}`
        : `/runs/${encodedRun}/logs#event-${evidence.seq}`;
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

import type { CompletionEvidence } from "@otomat/domain";
import { FOCUS_RING, Icon } from "@otomat/ui";

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
      className={`inline-flex h-6 items-center rounded-sm px-1 text-xs text-text-tertiary hover:bg-hover hover:text-text-secondary ${FOCUS_RING}`}
    >
      {label ?? <Icon name="file-text" size="xs" aria-hidden />}
    </a>
  );
}

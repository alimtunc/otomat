import type { PullRequestPublishability } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import type { ReactNode } from "react";

export interface PullRequestSummaryProps {
  publishability: PullRequestPublishability;
  status: string;
  stateLabel: string;
  mode: ReactNode;
  connectionLabel?: string;
}

export function PullRequestSummary({
  publishability,
  status,
  stateLabel,
  mode,
  connectionLabel,
}: PullRequestSummaryProps) {
  return (
    <section
      aria-label="Publication status"
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4"
    >
      <div className="flex flex-wrap items-start gap-2">
        <Chip>{status}</Chip>
        <span className="text-sm text-text-secondary">{stateLabel}</span>
        <div className="ml-auto">{mode}</div>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        <span className="break-all font-mono">{publishability.head_ref ?? "No workspace"}</span> →{" "}
        {publishability.repository ?? "No GitHub remote"}
        {publishability.base_ref ? ` · ${publishability.base_ref}` : ""}
        {` · ${publishability.changed_files} files · +${publishability.additions} −${publishability.deletions}`}
        {publishability.dirty ? " · uncommitted work is committed by Otomat" : ""}
      </p>
      <p className="text-xs text-text-tertiary">
        {connectionLabel ? `${connectionLabel} · ` : ""}Publication does not merge automatically.
      </p>
    </section>
  );
}

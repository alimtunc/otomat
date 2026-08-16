import type { ExecutionSummaryEntry } from "@web/lib/execution/summary";

export interface ExecutionSummaryDetailProps {
  entries: ExecutionSummaryEntry[];
  /** How the installed CLI was read; the only place this technical line appears. */
  detection: string | null;
}

export function ExecutionSummaryDetail({ entries, detection }: ExecutionSummaryDetailProps) {
  return (
    <span className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <span key={entry.label}>
          <b className="font-medium">{entry.label}:</b> {entry.value}
        </span>
      ))}
      {detection === null ? null : <span className="mt-1 text-text-tertiary">{detection}</span>}
    </span>
  );
}

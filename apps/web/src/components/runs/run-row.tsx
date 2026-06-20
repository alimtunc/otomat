import type { RunContract } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

export function RunRow({ run }: { run: RunContract }) {
  return (
    <li>
      <Link
        to="/runs/$runId"
        params={{ runId: run.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-hover"
      >
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
          {run.branch}
        </span>
      </Link>
    </li>
  );
}

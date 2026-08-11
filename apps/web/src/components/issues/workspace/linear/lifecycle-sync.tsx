import type { LinearLifecycleSyncState } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useRetryLinearWrite } from "@web/api/linear/writeback";
import { LIFECYCLE_PHASE_LABEL } from "@web/lib/linear-lifecycle";

import { WRITE_STATUS_TEXT } from "./write-status-text";

export function LifecycleSync({
  issueId,
  lifecycle,
}: {
  issueId: string;
  lifecycle: LinearLifecycleSyncState;
}) {
  const retry = useRetryLinearWrite(issueId);
  return (
    <div
      id={`linear-write-${lifecycle.write_id}`}
      className="flex scroll-mt-4 items-start justify-between gap-2 text-xs"
    >
      <div className="min-w-0">
        <span className="text-text-secondary">Status sync</span>
        <span className={`ml-1.5 ${WRITE_STATUS_TEXT[lifecycle.status]}`}>{lifecycle.status}</span>
        <div className="truncate text-text-tertiary">
          {LIFECYCLE_PHASE_LABEL[lifecycle.phase]} → {lifecycle.target_state_name}
        </div>
        {lifecycle.status === "failed" && lifecycle.error_message ? (
          <div className="text-danger">{lifecycle.error_message}</div>
        ) : null}
      </div>
      {lifecycle.status === "failed" ? (
        <Button
          size="xs"
          variant="ghost"
          loading={retry.isPending}
          onClick={() => retry.mutate(lifecycle.write_id)}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

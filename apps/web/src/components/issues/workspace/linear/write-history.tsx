import type { LinearWriteContract, LinearWriteKind } from "@otomat/domain";
import { Button, toast } from "@otomat/ui";
import { linearWriteConflict, useRetryLinearWrite } from "@web/api/linear/writeback";

const KIND_LABEL: Record<LinearWriteKind, string> = {
  fields: "Fields",
  status: "Status",
  comment: "Comment",
  pr_link: "PR link",
};

const STATUS_TEXT: Record<LinearWriteContract["status"], string> = {
  pending: "text-text-tertiary",
  sending: "text-iris-text",
  sent: "text-success",
  failed: "text-danger",
};

function WriteRow({ issueId, write }: { issueId: string; write: LinearWriteContract }) {
  const retry = useRetryLinearWrite(issueId);
  return (
    <li className="flex items-start justify-between gap-2 border-t border-border-subtle py-1.5 text-xs first:border-t-0">
      <div className="min-w-0">
        <span className="text-text-secondary">{KIND_LABEL[write.kind]}</span>
        <span className={`ml-1.5 ${STATUS_TEXT[write.status]}`}>{write.status}</span>
        {write.detail ? <div className="truncate text-text-tertiary">{write.detail}</div> : null}
        {write.status === "failed" && write.error_message ? (
          <div className="text-danger">{write.error_message}</div>
        ) : null}
      </div>
      {write.status === "failed" ? (
        <Button
          size="xs"
          variant="ghost"
          loading={retry.isPending}
          onClick={() =>
            retry.mutate(write.id, {
              onError: (error) => {
                if (linearWriteConflict(error) !== null) {
                  toast.error(
                    "The Linear issue changed since this draft was made. Publish from the draft bar to resolve the conflict.",
                  );
                }
              },
            })
          }
        >
          Retry
        </Button>
      ) : null}
    </li>
  );
}

export function WriteHistory({
  issueId,
  writes,
}: {
  issueId: string;
  writes: LinearWriteContract[];
}) {
  if (writes.length === 0) return null;
  const ordered = writes.toReversed();
  const failedCount = writes.filter((write) => write.status === "failed").length;
  return (
    <details className="group" open={failedCount > 0}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-secondary [&::-webkit-details-marker]:hidden">
        <span className="transition-transform duration-100 group-open:rotate-90">›</span>
        History · {writes.length}
        {failedCount > 0 ? <span className="text-danger">· {failedCount} failed</span> : null}
      </summary>
      <ul className="mt-1.5 flex flex-col">
        {ordered.map((write) => (
          <WriteRow key={write.id} issueId={issueId} write={write} />
        ))}
      </ul>
    </details>
  );
}

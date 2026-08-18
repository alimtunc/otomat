import { Button, RelativeTime } from "@otomat/ui";
import type { PullRequestInboxSyncState } from "@web/api/reviews/use-inbox-sync";

export interface ReviewSyncNoticeProps {
  sync: PullRequestInboxSyncState;
  message: string;
}

export function ReviewSyncNotice({ sync, message }: ReviewSyncNoticeProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-2 px-3 py-1.5">
      <p className="m-0 text-xs text-text-secondary">
        {message}{" "}
        {sync.last_synced_at === null ? (
          "Nothing has been reconciled yet."
        ) : (
          <>
            Showing what GitHub answered <RelativeTime date={sync.last_synced_at} />.
          </>
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        loading={sync.running}
        onClick={sync.refresh}
      >
        Retry
      </Button>
    </div>
  );
}

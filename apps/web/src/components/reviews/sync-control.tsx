import { Button, RelativeTime } from "@otomat/ui";
import type { PullRequestInboxSyncState } from "@web/api/reviews/use-inbox-sync";
import type { ReactNode } from "react";

export interface ReviewSyncControlProps {
  sync: PullRequestInboxSyncState;
}

export function ReviewSyncControl({ sync }: ReviewSyncControlProps) {
  if (sync.repositories === null) return null;

  const freshness = (): ReactNode => {
    if (sync.repositories === 0) return "No repository to reconcile";
    if (sync.last_synced_at === null) return "Never synced with GitHub";
    return (
      <>
        Synced <RelativeTime date={sync.last_synced_at} />
      </>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-tertiary">{freshness()}</span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        loading={sync.running}
        disabled={sync.repositories === 0}
        onClick={sync.refresh}
      >
        Refresh
      </Button>
    </div>
  );
}

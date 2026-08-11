import { Button, RelativeTime } from "@otomat/ui";

export interface StaleNoticeProps {
  dataUpdatedAt: number;
  refreshing: boolean;
  onRetry: () => void;
}

/** Discreet banner above data whose background refresh failed: freshness plus Retry, never a blank view. */
export function StaleNotice({ dataUpdatedAt, refreshing, onRetry }: StaleNoticeProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-2 px-3 py-1.5">
      <p className="text-xs text-text-secondary">
        Couldn’t refresh — showing data from <RelativeTime date={dataUpdatedAt} />.
      </p>
      <Button type="button" variant="outline" size="xs" loading={refreshing} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

import { Button, RelativeTime, SETTLE_IN_CLASS } from "@otomat/ui";

export interface StaleNoticeProps {
  dataUpdatedAt: number;
  refreshing: boolean;
  onRetry: () => void;
  reason?: string;
}

export function StaleNotice({ dataUpdatedAt, refreshing, onRetry, reason }: StaleNoticeProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-2 px-3 py-1.5 ${SETTLE_IN_CLASS}`}
    >
      <p className="text-xs text-text-secondary">
        Couldn’t refresh — showing data from <RelativeTime date={dataUpdatedAt} />.
        {reason === undefined ? null : ` ${reason}`}
      </p>
      <Button type="button" variant="outline" size="xs" loading={refreshing} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

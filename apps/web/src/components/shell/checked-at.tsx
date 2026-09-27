import { Icon, IconButton, RelativeTime } from "@otomat/ui";

export function CheckedAt({
  checkedAt,
  label,
  refreshing,
  onRefresh,
}: {
  checkedAt: string;
  label: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
      <span className="text-xs text-text-tertiary">
        Checked <RelativeTime date={checkedAt} />
      </span>
      <IconButton
        size="sm"
        label={label}
        icon={<Icon name="refresh-cw" aria-hidden />}
        loading={refreshing}
        onClick={onRefresh}
      />
    </div>
  );
}

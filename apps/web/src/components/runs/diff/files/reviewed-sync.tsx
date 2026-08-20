import type { ReviewedFileContract } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";

export interface ReviewedSyncBadgeProps {
  mark: ReviewedFileContract;
  onRetry: () => void;
}

export function ReviewedSyncBadge({ mark, onRetry }: ReviewedSyncBadgeProps) {
  const failed = mark.sync_status === "failed";
  return (
    <span className="flex min-w-0 items-center gap-1">
      {mark.sync_error === null ? null : (
        <span
          role="alert"
          title={mark.sync_error}
          className="max-w-40 truncate font-sans text-xs text-danger"
        >
          {mark.sync_error}
        </span>
      )}
      <IconButton
        size="sm"
        className={failed ? "text-danger" : "text-text-tertiary"}
        label={
          failed
            ? `Retry syncing ${mark.file_path} to GitHub`
            : `${mark.file_path} has not reached GitHub yet — retry`
        }
        icon={<Icon name={failed ? "alert-triangle" : "refresh-cw"} />}
        onClick={onRetry}
      />
    </span>
  );
}

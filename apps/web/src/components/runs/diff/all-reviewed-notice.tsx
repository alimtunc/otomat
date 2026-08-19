import { EmptyState } from "@otomat/ui";

export interface DiffAllReviewedNoticeProps {
  count: number;
}

export function DiffAllReviewedNotice({ count }: DiffAllReviewedNoticeProps) {
  return (
    <EmptyState
      variant="compact"
      icon="check"
      title="All files reviewed"
      description={`${count} changed ${count === 1 ? "file is" : "files are"} marked Reviewed. Uncheck one to reopen it.`}
    />
  );
}

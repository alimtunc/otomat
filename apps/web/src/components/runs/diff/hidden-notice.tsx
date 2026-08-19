import { Button, Icon } from "@otomat/ui";

export interface HiddenReviewedNoticeProps {
  count: number;
  onShow: () => void;
}

export function HiddenReviewedNotice({ count, onShow }: HiddenReviewedNoticeProps) {
  if (count === 0) return null;
  const label = count === 1 ? "1 reviewed file hidden" : `${count} reviewed files hidden`;
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-text-tertiary">
      <Icon name="check" aria-hidden className="h-3.5 w-3.5 text-success" />
      {label}
      <Button variant="ghost" size="xs" className="ml-auto" onClick={onShow}>
        Show them
      </Button>
    </div>
  );
}

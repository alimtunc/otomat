import { Button, Icon } from "@otomat/ui";

export function JumpToLatest({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
      <Button
        type="button"
        size="sm"
        onClick={onClick}
        className="pointer-events-auto rounded-full shadow-[var(--shadow-overlay)]"
      >
        <Icon name="arrow-down" aria-hidden />
        Jump to latest
      </Button>
    </div>
  );
}

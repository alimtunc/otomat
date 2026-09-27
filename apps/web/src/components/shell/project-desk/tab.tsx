import { cn, FOCUS_RING_INSET, Icon, IconButton } from "@otomat/ui";

import type { DeskTab } from "./state";

export interface DeskTabItemProps {
  tab: DeskTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onMove: (offset: number) => void;
  onAdjacent: (offset: number) => void;
  onDrop: (id: string) => void;
}
export function DeskTabItem({
  tab,
  active,
  onSelect,
  onClose,
  onMove,
  onAdjacent,
  onDrop,
}: DeskTabItemProps) {
  return (
    <div
      className={cn(
        "group flex h-9 min-w-0 max-w-60 shrink-0 items-center border-b-2 pr-1",
        active ? "border-iris bg-selected" : "border-transparent hover:bg-hover",
      )}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("application/otomat-view-tab", tab.id)}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/otomat-view-tab"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("application/otomat-view-tab"));
      }}
    >
      <button
        type="button"
        data-desk-tab={tab.id}
        aria-current={active ? "page" : undefined}
        title={tab.label}
        className={cn(
          "h-full min-w-0 truncate px-3 text-sm",
          FOCUS_RING_INSET,
          active ? "text-foreground" : "text-text-secondary",
        )}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const offset = event.key === "ArrowLeft" ? -1 : 1;
            if (event.altKey) onMove(offset);
            else onAdjacent(offset);
          }
          if (event.key === "Delete") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        {tab.label}
      </button>
      <IconButton
        size="sm"
        label={`Close tab: ${tab.label}`}
        icon={<Icon name="x" aria-hidden />}
        onClick={onClose}
        className="shrink-0 text-text-tertiary"
      />
    </div>
  );
}

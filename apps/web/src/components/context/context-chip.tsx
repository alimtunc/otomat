import { Chip, Icon, Popover, PopoverContent, PopoverTrigger, type IconName } from "@otomat/ui";
import type { KeyboardEvent, ReactNode } from "react";

export interface ContextChipProps {
  icon: IconName;
  label: string;
  preview: ReactNode;
  onRemove?: () => void;
}

export function ContextChip({ icon, label, preview, onRemove }: ContextChipProps) {
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    if (onRemove === undefined) return;
    event.preventDefault();
    onRemove();
  };

  return (
    <Chip className="gap-0 pr-0.5" role="listitem">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-1.25 rounded-sm px-0.5"
              onKeyDown={keyDown}
              aria-label={`Preview ${label}`}
            >
              <Icon name={icon} aria-hidden />
              <span className="max-w-50 truncate">{label}</span>
            </button>
          }
        />
        <PopoverContent align="start" className="max-h-80 w-96 overflow-auto p-3 text-xs">
          {preview}
        </PopoverContent>
      </Popover>
      {onRemove === undefined ? null : (
        <button
          type="button"
          className="rounded-sm p-0.5 text-text-tertiary hover:text-foreground"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <Icon name="x" aria-hidden />
        </button>
      )}
    </Chip>
  );
}

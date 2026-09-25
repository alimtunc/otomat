import { Icon, IconButton } from "@otomat/ui";
import { useRef } from "react";
import { flushSync } from "react-dom";

export interface MoveButtonsProps {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: -1 | 1) => void;
}

export function MoveButtons({ label, canMoveUp, canMoveDown, onMove }: MoveButtonsProps) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  // A reorder moves the row's DOM node, which drops focus.
  const move = (offset: -1 | 1): void => {
    flushSync(() => onMove(offset));
    const [pressed, other] = offset < 0 ? [up.current, down.current] : [down.current, up.current];
    (pressed?.disabled ? other : pressed)?.focus();
  };
  return (
    <>
      <IconButton
        ref={up}
        type="button"
        size="sm"
        label={`Move ${label} up`}
        icon={<Icon name="arrow-up" aria-hidden />}
        disabled={!canMoveUp}
        onClick={() => move(-1)}
      />
      <IconButton
        ref={down}
        type="button"
        size="sm"
        label={`Move ${label} down`}
        icon={<Icon name="arrow-down" aria-hidden />}
        disabled={!canMoveDown}
        onClick={() => move(1)}
      />
    </>
  );
}

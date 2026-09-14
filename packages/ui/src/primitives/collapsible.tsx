import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { ComponentPropsWithRef } from "react";

export interface CollapsibleProps extends ComponentPropsWithRef<typeof CollapsiblePrimitive.Root> {}

export function Collapsible({ onKeyDown, ...props }: CollapsibleProps) {
  return (
    <CollapsiblePrimitive.Root
      {...props}
      data-slot="collapsible"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key !== "Escape" || event.defaultPrevented || event.isPropagationStopped())
          return;
        const root = event.currentTarget;
        if (
          !(event.target instanceof HTMLElement) ||
          event.target.closest('[data-slot="collapsible"]') !== root
        )
          return;
        const trigger = [
          ...root.querySelectorAll<HTMLButtonElement>('button[aria-expanded="true"]'),
        ].find(
          (button) =>
            !button.hidden &&
            !button.disabled &&
            button.closest('[data-slot="collapsible"]') === root,
        );
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
        trigger.click();
        trigger.focus();
      }}
    />
  );
}

export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
export const CollapsiblePanel = CollapsiblePrimitive.Panel;

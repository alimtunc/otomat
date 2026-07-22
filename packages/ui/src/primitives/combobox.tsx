import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";
import { FIELD_TRANSITION } from "./styles";

export const Combobox = ComboboxPrimitive.Root;
export const ComboboxTrigger = ComboboxPrimitive.Trigger;
export const ComboboxValue = ComboboxPrimitive.Value;
export const ComboboxItemIndicator = ComboboxPrimitive.ItemIndicator;

export type ComboboxInputProps = ComponentPropsWithoutRef<typeof ComboboxPrimitive.Input>;

export function ComboboxInput({ className, style, ...props }: ComboboxInputProps) {
  return (
    <ComboboxPrimitive.Input
      className={cn(
        "h-9 w-full border-b border-border-subtle bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-text-tertiary",
        "focus:border-iris-ring focus:shadow-[inset_0_-1px_var(--iris-ring)]",
        className,
      )}
      style={{ transition: FIELD_TRANSITION, ...style }}
      {...props}
    />
  );
}

export interface ComboboxContentProps extends ComponentPropsWithoutRef<
  typeof ComboboxPrimitive.Popup
> {
  align?: ComponentPropsWithoutRef<typeof ComboboxPrimitive.Positioner>["align"];
  side?: ComponentPropsWithoutRef<typeof ComboboxPrimitive.Positioner>["side"];
  sideOffset?: ComponentPropsWithoutRef<typeof ComboboxPrimitive.Positioner>["sideOffset"];
}

export function ComboboxContent({
  className,
  align = "start",
  side,
  sideOffset = 6,
  ...props
}: ComboboxContentProps) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="outline-none"
        style={{ zIndex: "var(--z-popover)" }}
      >
        <ComboboxPrimitive.Popup
          className={cn(
            "min-w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-lg border border-border bg-popover text-foreground shadow-(--shadow-overlay)",
            "origin-(--transform-origin) transition-[opacity,transform] duration-100",
            "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export type ComboboxListProps = ComponentPropsWithoutRef<typeof ComboboxPrimitive.List>;

export function ComboboxList({ className, ...props }: ComboboxListProps) {
  return (
    <ComboboxPrimitive.List
      className={cn(
        "max-h-[min(46vh,var(--available-height))] overflow-auto p-1.5 outline-none data-empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

export type ComboboxEmptyProps = ComponentPropsWithoutRef<typeof ComboboxPrimitive.Empty>;

export function ComboboxEmpty({ className, ...props }: ComboboxEmptyProps) {
  return (
    <ComboboxPrimitive.Empty
      className={cn("py-6 text-center text-sm text-text-tertiary", className)}
      {...props}
    />
  );
}

export type ComboboxItemProps = ComponentPropsWithoutRef<typeof ComboboxPrimitive.Item>;

export function ComboboxItem({ className, ...props }: ComboboxItemProps) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "flex min-h-9.5 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary outline-none",
        "data-highlighted:bg-hover data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:size-3.75 [&_svg]:shrink-0 [&_svg]:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

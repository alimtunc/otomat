import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { MENU_CONTENT_CLASS as contentClass, MENU_ITEM_CLASS as itemClass } from "../lib/styles";
import { cn } from "../lib/utils";

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuPortal = ContextMenuPrimitive.Portal;
export const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

export type ContextMenuContentProps = ComponentPropsWithRef<typeof ContextMenuPrimitive.Popup> & {
  collisionPadding?: ComponentPropsWithRef<
    typeof ContextMenuPrimitive.Positioner
  >["collisionPadding"];
};

export function ContextMenuContent({
  className,
  collisionPadding = 8,
  ref,
  ...props
}: ContextMenuContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        collisionPadding={collisionPadding}
        style={{ zIndex: "var(--z-popover)" }}
      >
        <ContextMenuPrimitive.Popup ref={ref} className={cn(contentClass, className)} {...props} />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

export type ContextMenuItemProps = ComponentPropsWithRef<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
};

export function ContextMenuItem({ className, inset, ref, ...props }: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(itemClass, inset && "pl-7", className)}
      {...props}
    />
  );
}

export type ContextMenuCheckboxItemProps = ComponentPropsWithRef<
  typeof ContextMenuPrimitive.CheckboxItem
>;

export function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ref,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(itemClass, className)}
      {...props}
    >
      {children}
      <ContextMenuPrimitive.CheckboxItemIndicator className="ml-auto text-iris-text">
        <Check />
      </ContextMenuPrimitive.CheckboxItemIndicator>
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export type ContextMenuRadioItemProps = ComponentPropsWithRef<
  typeof ContextMenuPrimitive.RadioItem
>;

export function ContextMenuRadioItem({
  className,
  children,
  ref,
  ...props
}: ContextMenuRadioItemProps) {
  return (
    <ContextMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, className)} {...props}>
      {children}
      <ContextMenuPrimitive.RadioItemIndicator className="ml-auto text-iris-text">
        <Circle className="h-2! w-2! fill-current" />
      </ContextMenuPrimitive.RadioItemIndicator>
    </ContextMenuPrimitive.RadioItem>
  );
}

export type ContextMenuLabelProps = ComponentPropsWithRef<
  typeof ContextMenuPrimitive.GroupLabel
> & {
  inset?: boolean;
};

export function ContextMenuLabel({ className, inset, ref, ...props }: ContextMenuLabelProps) {
  return (
    <ContextMenuPrimitive.GroupLabel
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-micro font-semibold tracking-[0.03em] text-text-tertiary",
        inset && "pl-7",
        className,
      )}
      {...props}
    />
  );
}

export type ContextMenuSeparatorProps = ComponentPropsWithRef<
  typeof ContextMenuPrimitive.Separator
>;

export function ContextMenuSeparator({ className, ref, ...props }: ContextMenuSeparatorProps) {
  return (
    <ContextMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1.25 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}

export type ContextMenuShortcutProps = {
  className?: string;
  children?: ReactNode;
};

export function ContextMenuShortcut({ className, children }: ContextMenuShortcutProps) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-text-tertiary tabular-nums", className)}
    >
      {children}
    </span>
  );
}

export type ContextMenuSubTriggerProps = ComponentPropsWithRef<
  typeof ContextMenuPrimitive.SubmenuTrigger
> & { inset?: boolean };

export function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      ref={ref}
      className={cn(
        itemClass,
        "data-[popup-open]:bg-hover data-[popup-open]:text-foreground",
        inset && "pl-7",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

export type ContextMenuSubContentProps = ComponentPropsWithRef<typeof ContextMenuPrimitive.Popup>;

export function ContextMenuSubContent({ className, ref, ...props }: ContextMenuSubContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner style={{ zIndex: "var(--z-popover)" }}>
        <ContextMenuPrimitive.Popup ref={ref} className={cn(contentClass, className)} {...props} />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

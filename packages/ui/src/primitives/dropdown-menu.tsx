import { Menu } from "@base-ui/react/menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { MENU_CONTENT_CLASS as contentClass, MENU_ITEM_CLASS as itemClass } from "../lib/styles";
import { cn } from "../lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuPortal = Menu.Portal;
export const DropdownMenuSub = Menu.SubmenuRoot;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export type DropdownMenuContentProps = ComponentPropsWithRef<typeof Menu.Popup> & {
  side?: ComponentPropsWithRef<typeof Menu.Positioner>["side"];
  sideOffset?: number;
  align?: ComponentPropsWithRef<typeof Menu.Positioner>["align"];
  collisionPadding?: ComponentPropsWithRef<typeof Menu.Positioner>["collisionPadding"];
};

export function DropdownMenuContent({
  className,
  side,
  sideOffset = 6,
  align,
  collisionPadding = 8,
  ref,
  ...props
}: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        style={{ zIndex: "var(--z-popover)" }}
      >
        <Menu.Popup ref={ref} className={cn(contentClass, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export type DropdownMenuItemProps = ComponentPropsWithRef<typeof Menu.Item> & {
  inset?: boolean;
};

export function DropdownMenuItem({ className, inset, ref, ...props }: DropdownMenuItemProps) {
  return <Menu.Item ref={ref} className={cn(itemClass, inset && "pl-7", className)} {...props} />;
}

export type DropdownMenuCheckboxItemProps = ComponentPropsWithRef<typeof Menu.CheckboxItem>;

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ref,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <Menu.CheckboxItem ref={ref} checked={checked} className={cn(itemClass, className)} {...props}>
      {children}
      <Menu.CheckboxItemIndicator className="ml-auto text-iris-text">
        <Check />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  );
}

export type DropdownMenuRadioItemProps = ComponentPropsWithRef<typeof Menu.RadioItem>;

export function DropdownMenuRadioItem({
  className,
  children,
  ref,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <Menu.RadioItem ref={ref} className={cn(itemClass, className)} {...props}>
      {children}
      <Menu.RadioItemIndicator className="ml-auto text-iris-text">
        <Circle className="h-2! w-2! fill-current" />
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  );
}

export type DropdownMenuLabelProps = ComponentPropsWithRef<typeof Menu.GroupLabel> & {
  inset?: boolean;
};

export function DropdownMenuLabel({ className, inset, ref, ...props }: DropdownMenuLabelProps) {
  return (
    <Menu.GroupLabel
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

export type DropdownMenuSeparatorProps = ComponentPropsWithRef<typeof Menu.Separator>;

export function DropdownMenuSeparator({ className, ref, ...props }: DropdownMenuSeparatorProps) {
  return (
    <Menu.Separator
      ref={ref}
      className={cn("my-1.25 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}

export type DropdownMenuShortcutProps = {
  className?: string;
  children?: ReactNode;
};

export function DropdownMenuShortcut({ className, children }: DropdownMenuShortcutProps) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-text-tertiary tabular-nums", className)}
    >
      {children}
    </span>
  );
}

export type DropdownMenuSubTriggerProps = ComponentPropsWithRef<typeof Menu.SubmenuTrigger> & {
  inset?: boolean;
};

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <Menu.SubmenuTrigger
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
    </Menu.SubmenuTrigger>
  );
}

export type DropdownMenuSubContentProps = ComponentPropsWithRef<typeof Menu.Popup> & {
  sideOffset?: number;
};

export function DropdownMenuSubContent({
  className,
  sideOffset = 6,
  ref,
  ...props
}: DropdownMenuSubContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={sideOffset} style={{ zIndex: "var(--z-popover)" }}>
        <Menu.Popup ref={ref} className={cn(contentClass, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { FIELD_TRANSITION } from "../lib/styles";
import { cn } from "../lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

const triggerVariants = cva(
  cn(
    "flex w-full items-center justify-between gap-2 bg-background text-foreground",
    "border border-input rounded-md font-sans text-sm",
    "data-[placeholder]:text-text-tertiary",
    "focus:outline-none focus-visible:border-iris-ring focus-visible:shadow-[0_0_0_3px_var(--iris-subtle-bg)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-[invalid=true]:border-danger",
    "[&>span]:truncate",
  ),
  {
    variants: {
      density: {
        compact: "h-8 px-2.5",
        comfortable: "h-9 px-3",
      },
    },
    defaultVariants: { density: "compact" },
  },
);

export interface SelectTriggerProps
  extends
    ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof triggerVariants> {
  invalid?: boolean;
}

export function SelectTrigger({
  className,
  density,
  invalid,
  style,
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      aria-invalid={invalid || undefined}
      className={cn(triggerVariants({ density }), className)}
      style={{ transition: FIELD_TRANSITION, ...style }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />}
      />
    </SelectPrimitive.Trigger>
  );
}

export interface SelectContentProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Popup> {
  sideOffset?: number;
}

export function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={sideOffset} className="z-[var(--z-popover)]">
        <SelectPrimitive.Popup
          className={cn(
            "relative min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-foreground shadow-[var(--shadow-overlay)]",
            "max-h-[var(--available-height)] min-w-[var(--anchor-width)] p-1",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export interface SelectItemProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  children: ReactNode;
}

export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-7 text-sm outline-none",
        "data-[highlighted]:bg-iris-subtle data-[highlighted]:text-iris-text",
        "data-[checked]:text-iris-text",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export interface SelectLabelProps extends ComponentPropsWithoutRef<
  typeof SelectPrimitive.GroupLabel
> {}

export function SelectLabel({ className, ...props }: SelectLabelProps) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn("px-2 py-1.5 text-xs font-medium text-text-secondary", className)}
      {...props}
    />
  );
}

export interface SelectSeparatorProps extends ComponentPropsWithoutRef<
  typeof SelectPrimitive.Separator
> {}

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

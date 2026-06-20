import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "../lib/utils";

export type CommandProps = ComponentPropsWithRef<typeof CommandPrimitive>;

export function Command({ className, ref, ...props }: CommandProps) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-popover text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export type CommandInputProps = ComponentPropsWithRef<typeof CommandPrimitive.Input>;

export function CommandInput({ className, ref, ...props }: CommandInputProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3.5">
      <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          "flex-1 border-0 bg-transparent text-md text-foreground outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export type CommandListProps = ComponentPropsWithRef<typeof CommandPrimitive.List>;

export function CommandList({ className, ref, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn("max-h-[46vh] overflow-auto p-1.5", className)}
      {...props}
    />
  );
}

export type CommandEmptyProps = ComponentPropsWithRef<typeof CommandPrimitive.Empty>;

export function CommandEmpty({ className, ref, ...props }: CommandEmptyProps) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      className={cn("py-6 text-center text-sm text-text-tertiary", className)}
      {...props}
    />
  );
}

const commandGroupHeadingClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.03em] [&_[cmdk-group-heading]]:text-text-tertiary";

export type CommandGroupProps = ComponentPropsWithRef<typeof CommandPrimitive.Group>;

export function CommandGroup({ className, ref, ...props }: CommandGroupProps) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn("text-foreground", commandGroupHeadingClass, className)}
      {...props}
    />
  );
}

export type CommandSeparatorProps = ComponentPropsWithRef<typeof CommandPrimitive.Separator>;

export function CommandSeparator({ className, ref, ...props }: CommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      className={cn("my-1.5 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}

export type CommandItemProps = ComponentPropsWithRef<typeof CommandPrimitive.Item>;

export function CommandItem({ className, ref, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        "flex h-9.5 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm text-text-secondary outline-none",
        "transition-[background-color,color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease)]",
        "data-[selected=true]:bg-hover data-[selected=true]:text-foreground",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:h-3.75 [&_svg]:w-3.75 [&_svg]:shrink-0 [&_svg]:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export type CommandItemIdProps = {
  className?: string;
  children?: ReactNode;
};

export function CommandItemId({ className, children }: CommandItemIdProps) {
  return (
    <span className={cn("w-11.5 text-xs text-text-tertiary tabular-nums", className)}>
      {children}
    </span>
  );
}

export type CommandItemRightProps = {
  className?: string;
  children?: ReactNode;
};

export function CommandItemRight({ className, children }: CommandItemRightProps) {
  return <span className={cn("ml-auto text-text-tertiary", className)}>{children}</span>;
}

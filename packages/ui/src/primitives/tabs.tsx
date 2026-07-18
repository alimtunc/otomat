import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../lib/utils";

const tabsListVariants = cva("flex items-center gap-0.5 border-b border-border-subtle", {
  variants: {
    density: {
      compact: "",
      comfortable: "",
    },
    bordered: {
      true: "",
      false: "border-b-0",
    },
  },
  defaultVariants: {
    density: "compact",
    bordered: true,
  },
});

const tabTriggerVariants = cva(
  [
    "relative inline-flex items-center gap-1.5 px-2.5 font-medium",
    "text-text-secondary outline-none",
    "transition-[color] duration-[--motion-fast] ease-standard",
    "hover:text-foreground",
    "data-[active]:text-foreground",
    "disabled:pointer-events-none disabled:opacity-50",
    "after:absolute after:left-2 after:right-2 after:bottom-[-1px] after:h-0.5 after:rounded-[2px] after:bg-iris after:opacity-0",
    "data-[active]:after:opacity-100",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      density: {
        compact: "h-8.5 text-sm",
        comfortable: "h-10 text-md",
      },
    },
    defaultVariants: {
      density: "compact",
    },
  },
);

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps
  extends
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

export function TabsList({ className, density, bordered, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(tabsListVariants({ density, bordered }), className)}
      {...props}
    />
  );
}

export interface TabsTriggerProps
  extends
    ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>,
    VariantProps<typeof tabTriggerVariants> {
  icon?: ReactNode;
  badge?: ReactNode;
}

export function TabsTrigger({
  className,
  density,
  icon,
  badge,
  children,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Tab className={cn(tabTriggerVariants({ density }), className)} {...props}>
      {icon}
      {children}
      {badge}
    </TabsPrimitive.Tab>
  );
}

export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>;

export function TabsContent({ className, ...props }: TabsContentProps) {
  return <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />;
}

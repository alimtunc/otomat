import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import { tabsListVariants, tabTriggerVariants } from "./tabs-variants";

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

import type { ReactElement, ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { Icon, type IconName } from "./icon";
import { Kbd } from "./kbd";

export interface SidebarNavItemRenderProps {
  className: string;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
}

export interface SidebarNavItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  badgeCount?: number;
  live?: boolean;
  kbd?: string;
  collapsed?: boolean;
  href?: string;
  onClick?: () => void;
  render?: (props: SidebarNavItemRenderProps) => ReactNode;
}

export function SidebarNavItem({
  icon,
  label,
  active = false,
  badgeCount,
  live = false,
  kbd,
  collapsed = false,
  href,
  onClick,
  render,
}: SidebarNavItemProps) {
  const className = cn(
    "group flex h-7.25 items-center gap-2.25 rounded-md px-2 text-sm font-[450]",
    "text-text-secondary hover:bg-hover hover:text-foreground",
    "focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]",
    active && "bg-selected text-foreground",
    collapsed && "justify-center px-0",
  );

  const iconEl = (
    <Icon
      name={icon}
      className={cn(
        "h-4 w-4 shrink-0",
        active ? "text-iris-text" : "text-text-tertiary group-hover:text-text-secondary",
      )}
    />
  );

  const rightEl =
    !collapsed && (badgeCount != null || live || kbd) ? (
      <span className="ml-auto inline-flex items-center gap-1.5">
        {live ? (
          <span
            className="inline-block h-1.75 w-1.75 rounded-full"
            style={{ background: "var(--iris-solid)" }}
          />
        ) : null}
        {badgeCount != null ? (
          <span className="inline-flex h-4.5 items-center rounded-sm bg-iris-subtle px-1.5 text-micro font-medium tabular-nums text-iris-text">
            {badgeCount}
          </span>
        ) : null}
        {kbd ? <Kbd>{kbd}</Kbd> : null}
      </span>
    ) : null;

  const inner = (
    <>
      {iconEl}
      {!collapsed ? <span className="truncate">{label}</span> : null}
      {rightEl}
    </>
  );

  const ariaCurrent: "page" | undefined = active ? "page" : undefined;

  let node: ReactNode;
  if (render) {
    node = render({ className, children: inner, "aria-current": ariaCurrent });
  } else if (onClick) {
    node = (
      <Button
        type="button"
        variant="ghost"
        className={className}
        aria-current={ariaCurrent}
        onClick={onClick}
      >
        {inner}
      </Button>
    );
  } else {
    node = (
      <a className={className} href={href} aria-current={ariaCurrent} onClick={onClick}>
        {inner}
      </a>
    );
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={node as ReactElement} />
        <TooltipContent side="right">
          {label}
          {badgeCount != null ? ` · ${badgeCount}` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return node;
}

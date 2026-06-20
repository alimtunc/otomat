import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { cn } from "../lib/utils";
import type { BreadcrumbItem } from "../types/shell";

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  renderLink?: (item: BreadcrumbItem, children: ReactNode) => ReactNode;
}

export function Breadcrumbs({ items, className, renderLink }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 items-center gap-1.75 whitespace-nowrap text-sm text-text-secondary",
        className,
      )}
    >
      {items.map((item, i) => {
        const isCurrent = item.current ?? i === items.length - 1;
        const text = (
          <span className={cn("truncate", isCurrent && "font-semibold text-foreground")}>
            {item.label}
          </span>
        );
        let content: ReactNode = text;
        if (!isCurrent && item.href && renderLink) {
          content = renderLink(item, text);
        } else if (!isCurrent && item.href) {
          content = (
            <a
              href={item.href}
              className="truncate hover:text-foreground focus-visible:outline-none focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:rounded-sm"
              style={{ transition: "color var(--motion-fast) var(--ease)" }}
            >
              {text}
            </a>
          );
        }
        return (
          <Fragment key={i}>
            {i > 0 ? (
              <ChevronRight aria-hidden className="h-3.25 w-3.25 flex-none text-text-tertiary" />
            ) : null}
            <span aria-current={isCurrent ? "page" : undefined} className="min-w-0">
              {content}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}

import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { FOCUS_RING } from "../lib/focus";
import { cn } from "../lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  renderLink?: (item: BreadcrumbItem, children: ReactNode) => ReactNode;
}

export function Breadcrumbs({ items, className, renderLink }: BreadcrumbsProps) {
  // Shrinking every crumb proportionally decays the short ones into initials.
  const shrinking = items.reduce(
    (longest, item, i) => (item.label.length > (items[longest]?.label.length ?? 0) ? i : longest),
    0,
  );
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
              className={cn("truncate hover:text-foreground focus-visible:rounded-sm", FOCUS_RING)}
              style={{ transition: "color var(--motion-fast) var(--ease)" }}
            >
              {text}
            </a>
          );
        }
        return (
          <Fragment key={`${item.label} ${item.href ?? ""}`}>
            {i > 0 ? (
              <ChevronRight aria-hidden className="h-3.25 w-3.25 flex-none text-text-tertiary" />
            ) : null}
            {/* flex blockifies the inline link/text so their `truncate` can actually elide. */}
            <span
              aria-current={isCurrent ? "page" : undefined}
              title={i === shrinking ? item.label : undefined}
              className={cn("flex", i === shrinking ? "min-w-0" : "flex-none")}
            >
              {content}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}

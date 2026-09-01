import { FOCUS_RING_INSET, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { type ReactNode, useId } from "react";

const HEADING_CLASS = "flex h-8 items-center gap-2 px-2.5 text-sm font-medium text-foreground";

export interface InboxGroupProps {
  label: string;
  count: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

export function InboxGroup({
  label,
  count,
  collapsed = false,
  onToggle,
  children,
}: InboxGroupProps) {
  const rowsId = useId();
  const heading = (
    <>
      <span className="truncate">{label}</span>
      <CountBadge count={count} tone="neutral" />
    </>
  );

  return (
    <section className="flex flex-col">
      {onToggle === undefined ? (
        <h2 className={HEADING_CLASS}>{heading}</h2>
      ) : (
        <h2>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={rowsId}
            onClick={onToggle}
            className={`${HEADING_CLASS} w-full ${FOCUS_RING_INSET}`}
          >
            <Icon
              name="chevron-down"
              size="xs"
              aria-hidden
              className={collapsed ? "-rotate-90 text-text-tertiary" : "text-text-tertiary"}
            />
            {heading}
          </button>
        </h2>
      )}
      {collapsed ? null : (
        <ul id={rowsId} className="flex flex-col gap-0.5 px-2 pb-2">
          {children}
        </ul>
      )}
    </section>
  );
}

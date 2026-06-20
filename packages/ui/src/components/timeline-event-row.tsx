import type { EventSource, EventType } from "@otomat/domain/types";
import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from "react";

import { EVENT_GLYPH, PROVENANCE_LABEL, PROVENANCE_VAR, TONE_BG, TONE_COLOR } from "../lib/status";
import { cn } from "../lib/utils";
import { RelativeTime } from "./relative-time";

export interface TimelineEventRowProps {
  type: EventType;
  provenance: EventSource;
  summary: ReactNode;
  at: Date | string | number;
  selected?: boolean;
  isNew?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
  className?: string;
}

export function TimelineEventRow({
  type,
  provenance,
  summary,
  at,
  selected = false,
  isNew = false,
  onSelect,
  children,
  className,
}: TimelineEventRowProps) {
  const glyph = EVENT_GLYPH[type];
  const Icon = glyph.icon;
  const tone = glyph.tone;

  const interactive = Boolean(onSelect);

  let background = TONE_BG[tone];
  if (isNew) background = "var(--iris-bg)";
  if (selected) background = "var(--selected)";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.();
    }
  };

  const interactiveProps: ComponentPropsWithoutRef<"div"> = interactive
    ? {
        role: "button",
        tabIndex: 0,
        "aria-current": selected ? "true" : undefined,
        onClick: onSelect,
        onKeyDown,
      }
    : { role: "listitem" };

  return (
    <div
      className={cn("group", className)}
      style={{
        display: "grid",
        gridTemplateColumns: "14px 56px 1fr",
        gap: 10,
        padding: "6px 16px",
        alignItems: "start",
        background,
        transition: "background var(--motion-fast) var(--ease)",
      }}
      {...interactiveProps}
    >
      <span
        aria-hidden
        title={PROVENANCE_LABEL[provenance]}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          marginTop: 5,
          background: PROVENANCE_VAR[provenance],
          boxShadow: "0 0 0 1px var(--ring-contrast-weak)",
        }}
      />

      <RelativeTime
        date={at}
        className="cursor-default pt-0.5 font-mono text-[10px] tabular-nums"
      />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <Icon
            aria-hidden
            style={{ width: 13, height: 13, flexShrink: 0, color: TONE_COLOR[tone] }}
          />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--foreground)" }}>{summary}</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {PROVENANCE_LABEL[provenance]} · {type}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

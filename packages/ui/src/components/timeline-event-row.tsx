import type { EventSource, EventType } from "@otomat/domain/types";
import { format } from "date-fns";
import type { ReactNode } from "react";

import { toDate } from "../lib/date";
import { EVENT_GLYPH, PROVENANCE_LABEL, PROVENANCE_VAR } from "../lib/provenance";
import { TONE_BG, TONE_TEXT } from "../lib/status";
import { cn } from "../lib/utils";

function EventTime({ at }: { at: Date | string | number }) {
  const resolved = toDate(at);
  const valid = !Number.isNaN(resolved.getTime());
  return (
    <time
      dateTime={valid ? resolved.toISOString() : undefined}
      title={valid ? format(resolved, "PPpp") : undefined}
      className="cursor-default pt-0.5 font-mono text-[10px] tabular-nums text-text-tertiary"
    >
      {valid ? format(resolved, "HH:mm:ss") : "—"}
    </time>
  );
}

export interface TimelineEventRowProps {
  type: EventType;
  provenance: EventSource;
  summary: ReactNode;
  at: Date | string | number;
  children?: ReactNode;
  className?: string;
}

export function TimelineEventRow({
  type,
  provenance,
  summary,
  at,
  children,
  className,
}: TimelineEventRowProps) {
  const glyph = EVENT_GLYPH[type];
  const Icon = glyph.icon;
  const tone = glyph.tone;

  return (
    <li
      className={cn("group", className)}
      style={{
        display: "grid",
        gridTemplateColumns: "14px 56px 1fr",
        gap: 10,
        padding: "6px 16px",
        alignItems: "start",
        background: TONE_BG[tone],
        transition: "background var(--motion-fast) var(--ease)",
      }}
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

      <EventTime at={at} />

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
            className={TONE_TEXT[tone]}
            style={{ width: 13, height: 13, flexShrink: 0 }}
          />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--foreground)" }}>{summary}</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {PROVENANCE_LABEL[provenance]} · {type}
          </span>
        </div>
        {children}
      </div>
    </li>
  );
}

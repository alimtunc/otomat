import { ChevronRight } from "lucide-react";
import { type ComponentPropsWithoutRef, type KeyboardEvent, useState } from "react";

import { cn } from "../lib/utils";
import { CopyButton } from "./copy-button";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRowProps {
  level: LogLevel;
  text: string;
  session?: string;
  ts?: string;
  collapsed?: boolean;
  wrap?: boolean;
  isNew?: boolean;
  className?: string;
}

const LEVEL_TEXT_COLOR: Record<LogLevel, string> = {
  debug: "var(--text-tertiary)",
  info: "var(--text-secondary)",
  warn: "var(--warning)",
  error: "var(--danger)",
};

const LEVEL_BG: Record<LogLevel, string | undefined> = {
  debug: undefined,
  info: undefined,
  warn: "var(--warning-bg)",
  error: "var(--danger-bg)",
};

function isMultiline(text: string): boolean {
  return text.includes("\n");
}

export function LogRow({
  level,
  text,
  session,
  ts,
  collapsed = true,
  wrap = true,
  isNew = false,
  className,
}: LogRowProps) {
  const multiline = isMultiline(text);
  const [open, setOpen] = useState(!collapsed);

  const expandable = multiline;
  const expanded = expandable ? open : true;

  const firstLine = expandable ? (text.split("\n", 1)[0] ?? "") : text;
  const shown = expanded ? text : firstLine;

  const toggle = () => {
    if (expandable) setOpen((o) => !o);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  const interactiveProps: ComponentPropsWithoutRef<"div"> = expandable
    ? { role: "button", tabIndex: 0, "aria-expanded": expanded, onClick: toggle, onKeyDown }
    : {};

  return (
    <div
      className={cn("group flex items-start gap-2", className)}
      style={{
        padding: "5px 16px",
        background: isNew ? "var(--iris-bg)" : LEVEL_BG[level],
        transition: "background var(--motion-fast) var(--ease)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
      }}
      {...interactiveProps}
    >
      {expandable ? (
        <ChevronRight
          aria-hidden
          style={{
            width: 12,
            height: 12,
            marginTop: 3,
            flexShrink: 0,
            color: "var(--text-tertiary)",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform var(--motion-fast) var(--ease)",
          }}
        />
      ) : (
        <span aria-hidden style={{ width: 12, flexShrink: 0 }} />
      )}

      {ts ? (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            paddingTop: 2,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {ts}
        </span>
      ) : null}

      <span
        aria-label={level.toUpperCase()}
        title={level.toUpperCase()}
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: ".04em",
          color: LEVEL_TEXT_COLOR[level],
          paddingTop: 2,
          flexShrink: 0,
          width: 38,
        }}
      >
        {level.toUpperCase()}
      </span>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: LEVEL_TEXT_COLOR[level],
          whiteSpace: wrap ? "pre-wrap" : "pre",
          overflow: wrap ? undefined : "hidden",
          textOverflow: wrap ? undefined : "ellipsis",
          wordBreak: wrap ? "break-word" : undefined,
        }}
      >
        {shown}
      </span>

      {session ? (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            paddingTop: 2,
            flexShrink: 0,
          }}
        >
          {session}
        </span>
      ) : null}

      <span className="shrink-0 pt-px" onClick={(e) => e.stopPropagation()}>
        <CopyButton
          value={text}
          label="Copy log line"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </span>
    </div>
  );
}

import { Popover } from "@base-ui/react/popover";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "../lib/utils";
import { LiveDot } from "./live-dot";

export type ConnectionState = "online" | "reconnecting" | "offline";

export interface ConnectionStatusIndicatorProps {
  state: ConnectionState;
  lastSyncAt?: Date | number | null;
  onRetry?: () => void;
  variant?: "dot" | "dot+label";
  className?: string;
}

interface StateMeta {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  dotColorVar: string;
  textClass: string;
  triggerTextClass: string;
  live: boolean;
}

const STATE_META: Record<ConnectionState, StateMeta> = {
  online: {
    label: "Online",
    icon: Wifi,
    dotColorVar: "var(--success)",
    textClass: "text-success",
    triggerTextClass: "text-text-secondary",
    live: false,
  },
  reconnecting: {
    label: "Reconnecting…",
    icon: RefreshCw,
    dotColorVar: "var(--warning)",
    textClass: "text-iris-text",
    triggerTextClass: "text-text-secondary",
    live: true,
  },
  offline: {
    label: "Offline · cached",
    icon: WifiOff,
    dotColorVar: "var(--text-tertiary)",
    textClass: "text-danger",
    triggerTextClass: "text-text-tertiary",
    live: false,
  },
};

function formatLastSync(lastSyncAt: Date | number | null | undefined): string {
  if (lastSyncAt == null) return "never";
  return `${formatDistanceToNow(lastSyncAt)} ago`;
}

export function ConnectionStatusIndicator({
  state,
  lastSyncAt,
  onRetry,
  variant = "dot+label",
  className,
}: ConnectionStatusIndicatorProps) {
  const meta = STATE_META[state];
  const Icon = meta.icon;

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-live="polite"
            aria-label={`Connection: ${meta.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.75 py-1 text-xs",
              "transition-colors hover:bg-surface-2",
              meta.triggerTextClass,
              className,
            )}
            style={{ transition: "background var(--motion-fast) var(--ease)" }}
          >
            <LiveDot live={meta.live} style={{ background: meta.dotColorVar }} />
            {variant === "dot+label" ? <span>{meta.label}</span> : null}
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6}>
          <Popover.Popup
            className={cn(
              "w-64 rounded-lg border border-border bg-popover p-3 text-sm text-foreground shadow-[var(--shadow-overlay)]",
            )}
            style={{ zIndex: "var(--z-popover)" }}
          >
            <div className={cn("flex items-center gap-1.5 font-medium", meta.textClass)}>
              <Icon className="h-3.5 w-3.5" aria-hidden={true} />
              <span>{meta.label}</span>
            </div>
            <dl className="mt-2 flex items-center justify-between text-text-secondary">
              <dt>Last sync</dt>
              <dd className="text-foreground">{formatLastSync(lastSyncAt)}</dd>
            </dl>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={state === "online"}
                className={cn(
                  "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs",
                  "bg-surface-1 transition-colors hover:bg-surface-2",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-1",
                )}
                style={{ transition: "background var(--motion-fast) var(--ease)" }}
              >
                <RefreshCw className="h-3 w-3" aria-hidden={true} />
                Retry now
              </button>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

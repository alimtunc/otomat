import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { ComponentType } from "react";

import { TONE_FACETS } from "../lib/status";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
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
    dotColorVar: TONE_FACETS.success.cssVar,
    textClass: TONE_FACETS.success.text,
    triggerTextClass: "text-text-secondary",
    live: false,
  },
  reconnecting: {
    label: "Reconnecting…",
    icon: RefreshCw,
    dotColorVar: TONE_FACETS.warning.cssVar,
    textClass: TONE_FACETS.warning.text,
    triggerTextClass: "text-text-secondary",
    live: true,
  },
  offline: {
    label: "Offline · cached",
    icon: WifiOff,
    dotColorVar: TONE_FACETS.ghost.cssVar,
    textClass: TONE_FACETS.danger.text,
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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-live="polite"
            aria-label={`Connection: ${meta.label}`}
            className={cn(
              "h-auto gap-1.5 px-1.75 py-1 text-xs font-normal",
              "transition-colors hover:bg-surface-2",
              meta.triggerTextClass,
              className,
            )}
            style={{ transition: "background var(--motion-fast) var(--ease)" }}
          >
            <LiveDot live={meta.live} style={{ background: meta.dotColorVar }} />
            {variant === "dot+label" ? <span>{meta.label}</span> : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 p-3 text-sm text-foreground">
        <div className={cn("flex items-center gap-1.5 font-medium", meta.textClass)}>
          <Icon className="h-3.5 w-3.5" aria-hidden={true} />
          <span>{meta.label}</span>
        </div>
        <dl className="mt-2 flex items-center justify-between text-text-secondary">
          <dt>Last sync</dt>
          <dd className="text-foreground">{formatLastSync(lastSyncAt)}</dd>
        </dl>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={state === "online"}
            className={cn(
              "mt-3 w-full gap-1.5 px-2.5 py-1.5 text-xs",
              "bg-surface-1 transition-colors hover:bg-surface-2",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-1",
            )}
            style={{ transition: "background var(--motion-fast) var(--ease)" }}
          >
            <RefreshCw className="h-3 w-3" aria-hidden={true} />
            Retry now
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

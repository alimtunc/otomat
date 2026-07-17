import { Check, Copy, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { TONE_FACETS } from "../lib/status";
import { cn } from "../lib/utils";

type CopyStatus = "idle" | "copied" | "error";

const ICON_BY_STATUS: Record<CopyStatus, LucideIcon> = {
  idle: Copy,
  copied: Check,
  error: X,
};

const COLOR_BY_STATUS: Record<CopyStatus, string> = {
  idle: TONE_FACETS.ghost.cssVar,
  copied: TONE_FACETS.success.cssVar,
  error: TONE_FACETS.danger.cssVar,
};

export interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  showLabel?: boolean;
  resetAfterMs?: number;
  onCopy?: (value: string) => void;
  onError?: (error: unknown) => void;
  className?: string;
  disabled?: boolean;
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  showLabel = false,
  resetAfterMs = 1600,
  onCopy,
  onError,
  className,
  disabled = false,
}: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // otomat-allow-effect: clear the pending status-reset timer on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const schedule = useCallback(
    (next: CopyStatus) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
      setStatus(next);
    },
    [resetAfterMs],
  );

  const copy = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      schedule("copied");
      onCopy?.(value);
    } catch (error) {
      schedule("error");
      onError?.(error);
    }
  }, [value, schedule, onCopy, onError]);

  const Icon = ICON_BY_STATUS[status];
  const textByStatus: Record<CopyStatus, string> = {
    idle: label,
    copied: copiedLabel,
    error: "Copy failed",
  };
  const text = textByStatus[status];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={copy}
      aria-label={text}
      aria-live="polite"
      data-status={status}
      className={cn(
        "copybtn inline-flex items-center gap-1.25 text-text-secondary disabled:opacity-50 disabled:pointer-events-none hover:text-foreground",
        className,
      )}
      style={{ transition: "color var(--motion-fast) var(--ease)" }}
    >
      <Icon size={12} aria-hidden="true" style={{ color: COLOR_BY_STATUS[status] }} />
      {showLabel ? <span className="text-xs">{text}</span> : null}
    </button>
  );
}

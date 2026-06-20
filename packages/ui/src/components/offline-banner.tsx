import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface OfflineBannerProps {
  message?: ReactNode;
  className?: string;
}

const DEFAULT_MESSAGE =
  "Daemon unreachable — showing last-known state from cache. Live actions disabled.";

export function OfflineBanner({ message = DEFAULT_MESSAGE, className }: OfflineBannerProps) {
  return (
    <output
      aria-live="polite"
      className={cn(
        "flex items-center gap-2.5 border-b border-border-subtle bg-warning-bg px-3.5 py-2 text-xs text-warning",
        className,
      )}
    >
      <WifiOff aria-hidden="true" style={{ width: 13, height: 13, flex: "none" }} />
      <span>{message}</span>
    </output>
  );
}

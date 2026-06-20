import { format, formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";

import { toDate } from "../lib/date";
import { cn } from "../lib/utils";

export interface RelativeTimeProps {
  date: Date | string | number;
  addSuffix?: boolean;
  absoluteFormat?: string;
  updateIntervalMs?: number;
  className?: string;
}

export function RelativeTime({
  date,
  addSuffix = true,
  absoluteFormat = "PPpp",
  updateIntervalMs = 30_000,
  className,
}: RelativeTimeProps) {
  const resolved = toDate(date);
  const [, force] = useState(0);

  // otomat-allow-effect: tick on an interval to refresh the displayed relative time.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), updateIntervalMs);
    return () => clearInterval(id);
  }, [updateIntervalMs]);

  const valid = !Number.isNaN(resolved.getTime());
  const relative = valid ? formatDistanceToNowStrict(resolved, { addSuffix }) : "unknown";
  const absolute = valid ? format(resolved, absoluteFormat) : "Invalid date";

  return (
    <time
      dateTime={valid ? resolved.toISOString() : undefined}
      title={absolute}
      className={cn("tnum text-text-tertiary", className)}
    >
      {relative}
    </time>
  );
}

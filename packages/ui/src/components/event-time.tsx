import { format } from "date-fns";

import { toDate } from "../lib/date";
import { cn } from "../lib/utils";

export interface EventTimeProps {
  at: Date | string | number;
  className?: string;
}

export function EventTime({ at, className }: EventTimeProps) {
  const resolved = toDate(at);
  const valid = !Number.isNaN(resolved.getTime());
  return (
    <time
      dateTime={valid ? resolved.toISOString() : undefined}
      title={valid ? format(resolved, "PPpp") : undefined}
      className={cn(
        "cursor-default pt-0.5 font-mono text-micro tabular-nums text-text-tertiary",
        className,
      )}
    >
      {valid ? format(resolved, "HH:mm:ss") : "—"}
    </time>
  );
}

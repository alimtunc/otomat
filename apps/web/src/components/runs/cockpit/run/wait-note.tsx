import type { RunWait } from "@otomat/domain";
import { describeRunWait } from "@web/lib/run/wait-copy";

export function RunWaitNote({ wait }: { wait: RunWait | null }) {
  if (wait === null) return null;
  return (
    <span role="status" className="shrink-0 text-xs text-text-secondary">
      {describeRunWait(wait)}
    </span>
  );
}

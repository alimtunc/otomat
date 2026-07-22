import type { LinearWriteContract } from "@otomat/domain";

import { WriteRow } from "./row";

export function WriteHistory({
  issueId,
  writes,
}: {
  issueId: string;
  writes: LinearWriteContract[];
}) {
  if (writes.length === 0) return null;
  const ordered = writes.toReversed();
  const failedCount = writes.filter((write) => write.status === "failed").length;
  return (
    <details className="group" open={failedCount > 0}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-secondary [&::-webkit-details-marker]:hidden">
        <span className="transition-transform duration-100 group-open:rotate-90">›</span>
        History · {writes.length}
        {failedCount > 0 ? <span className="text-danger">· {failedCount} failed</span> : null}
      </summary>
      <ul className="mt-1.5 flex flex-col">
        {ordered.map((write) => (
          <WriteRow key={write.id} issueId={issueId} write={write} />
        ))}
      </ul>
    </details>
  );
}

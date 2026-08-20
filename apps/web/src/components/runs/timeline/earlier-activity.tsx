import { Button } from "@otomat/ui";
import type { RunEventHistory } from "@web/api/runs/use-event-history";
import type { Ref } from "react";

export interface EarlierActivityProps {
  history: RunEventHistory;
  /** Only a list opening at its newest end takes a scroll trigger: at the top it would page the whole ledger. */
  ref?: Ref<HTMLLIElement>;
}

export function EarlierActivity({ history, ref }: EarlierActivityProps) {
  const { hasOlder, loadingOlder, olderFailed, loadOlder } = history;
  if (!hasOlder) return null;

  return (
    <li
      ref={ref}
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-6 py-2 text-xs text-text-tertiary"
    >
      {loadingOlder ? <span>Loading earlier activity…</span> : null}
      {olderFailed && !loadingOlder ? (
        <span className="text-danger">Couldn’t load earlier activity.</span>
      ) : null}
      {loadingOlder ? null : (
        <Button type="button" variant="ghost" size="xs" onClick={loadOlder}>
          {olderFailed ? "Retry" : "Load earlier activity"}
        </Button>
      )}
    </li>
  );
}

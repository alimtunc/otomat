export interface WorkspaceReconciliationLoop {
  stop(): void;
}

/** One pass at startup then one per interval, never two at once, on a timer that does not hold the process open. */
export function startWorkspaceReconciliation(
  reconcile: () => Promise<void>,
  intervalMs: number,
): WorkspaceReconciliationLoop {
  let running = false;
  const tick = (): void => {
    if (running) return;
    running = true;
    void reconcile()
      .catch((error: unknown) => {
        console.error("[otomat] background workspace reconciliation failed", error);
      })
      .finally(() => {
        running = false;
      });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

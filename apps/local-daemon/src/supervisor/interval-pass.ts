export interface IntervalPass {
  stop(): void;
}

/** One pass at startup then one per interval, never two at once, on a timer that does not hold the process open. */
export function startIntervalPass(
  label: string,
  pass: () => Promise<void>,
  intervalMs: number,
): IntervalPass {
  let running = false;
  const tick = (): void => {
    if (running) return;
    running = true;
    void pass()
      .catch((error: unknown) => {
        console.error(`[otomat] background ${label} failed`, error);
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

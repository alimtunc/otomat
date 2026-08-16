const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 15_000];

export interface ReconnectLoopOptions {
  attempt(): void;
  schedule?: ((callback: () => void, delayMs: number) => NodeJS.Timeout) | undefined;
}

/**
 * The capped backoff behind a session that keeps trying, plus the moment it stops calling the
 * failure a hiccup: once the schedule is exhausted the loop runs on at its ceiling, but the caller
 * reports the coded error instead of another "reconnecting", so a host that will never come up
 * says why rather than spinning forever.
 */
export class ReconnectLoop {
  private timer: NodeJS.Timeout | null = null;
  private attempts = 0;
  private ranOut = false;

  constructor(private readonly options: ReconnectLoopOptions) {}

  get exhausted(): boolean {
    return this.ranOut;
  }

  arm(): void {
    if (this.timer !== null) return;
    const index = Math.min(this.attempts, RECONNECT_DELAYS_MS.length - 1);
    this.ranOut ||= this.attempts >= RECONNECT_DELAYS_MS.length - 1;
    this.attempts += 1;
    const schedule = this.options.schedule ?? ((callback, ms) => setTimeout(callback, ms));
    this.timer = schedule(() => {
      this.timer = null;
      this.options.attempt();
    }, RECONNECT_DELAYS_MS[index] ?? 1_000);
  }

  reset(): void {
    this.attempts = 0;
    this.ranOut = false;
  }

  cancel(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

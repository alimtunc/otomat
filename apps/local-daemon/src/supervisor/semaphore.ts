export type SlotGrant = "acquired" | "canceled";

/**
 * Counting semaphore bounding how many session processes run at once. FIFO, no
 * priorities; waiters are keyed so a queued turn can be located and canceled.
 * Lowering the live limit never touches a holder, so `held` stays above `max`
 * until enough sessions end.
 */
export class Semaphore {
  private max: number;
  private held = 0;
  private readonly waiters: Array<{ key: string; grant: (grant: SlotGrant) => void }> = [];

  constructor(limit: number) {
    this.max = Math.max(1, limit);
  }

  get limit(): number {
    return this.max;
  }

  get active(): number {
    return this.held;
  }

  get waiting(): number {
    return this.waiters.length;
  }

  get free(): boolean {
    return this.held < this.max;
  }

  acquire(key: string): Promise<SlotGrant> {
    if (this.free) {
      this.held += 1;
      return Promise.resolve("acquired");
    }
    return new Promise<SlotGrant>((grant) => this.waiters.push({ key, grant }));
  }

  /** Resolves a queued waiter as `canceled` without granting; false when the key already holds a slot or is unknown. */
  cancel(key: string): boolean {
    const index = this.waiters.findIndex((waiter) => waiter.key === key);
    if (index === -1) return false;
    const removed = this.waiters[index];
    this.waiters.splice(index, 1);
    removed?.grant("canceled");
    return true;
  }

  /** Keys still queued for a slot, in grant order. */
  queued(): string[] {
    return this.waiters.map((waiter) => waiter.key);
  }

  release(): void {
    if (this.held === 0) throw new Error("session slot released more often than acquired");
    this.held -= 1;
    this.drain();
  }

  resize(limit: number): void {
    this.max = Math.max(1, limit);
    this.drain();
  }

  private drain(): void {
    while (this.free && this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next === undefined) return;
      this.held += 1;
      next.grant("acquired");
    }
  }
}

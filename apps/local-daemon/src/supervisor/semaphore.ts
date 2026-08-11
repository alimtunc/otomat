/**
 * Counting semaphore bounding how many session processes run at once. FIFO, no
 * priorities. Lowering the live limit never touches a holder, so `held` stays
 * above `max` until enough sessions end.
 */
export class Semaphore {
  private max: number;
  private held = 0;
  private readonly waiters: Array<() => void> = [];

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

  acquire(): Promise<void> {
    if (this.free) {
      this.held += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
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
      next();
    }
  }
}

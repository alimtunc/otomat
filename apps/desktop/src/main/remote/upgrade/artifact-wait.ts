import type { ArtifactWaitReason } from "./artifact.js";

const DELAYS_MS = [10_000, 20_000, 30_000, 60_000, 90_000];

/** How many checks each reason is worth: minutes for a bundle to appear, a CI run's length for CI. */
const ATTEMPTS = {
  no_run: 4,
  queued: 14,
  in_progress: 14,
  not_published: 4,
  unreadable: 3,
} satisfies Record<ArtifactWaitReason, number>;

/** The ceiling no sequence of reasons may pass, so a flapping workflow cannot wait forever. */
const TOTAL_ATTEMPTS = 24;

/**
 * The counters are keyed by build and reason: a reconnect that finds the same state resumes the
 * schedule rather than restarting it, and a re-run CI is waited out again from the start.
 */
export class ArtifactWait {
  private build: string | null = null;
  private reason: ArtifactWaitReason | null = null;
  private attempts = 0;
  private total = 0;

  next(build: string, reason: ArtifactWaitReason): number | null {
    if (build !== this.build) {
      this.build = build;
      this.reason = null;
      this.total = 0;
    }
    if (reason !== this.reason) {
      this.reason = reason;
      this.attempts = 0;
    }
    if (this.attempts >= ATTEMPTS[reason] || this.total >= TOTAL_ATTEMPTS) return null;
    const delay = DELAYS_MS[Math.min(this.attempts, DELAYS_MS.length - 1)];
    this.attempts += 1;
    this.total += 1;
    return delay;
  }

  reset(): void {
    this.build = null;
    this.reason = null;
    this.attempts = 0;
    this.total = 0;
  }
}

import { redactLogText, type DaemonLogEntry, type DaemonLogExcerpt } from "@otomat/domain";

/** Enough tail to cover a failing request and the work around it, small enough to never grow. */
const DIAGNOSTIC_LOG_CAPACITY = 200;

const MAX_MESSAGE_CHARACTERS = 2_000;
const TRUNCATION_MARK = " […]";

function bounded(message: string): string {
  if (message.length <= MAX_MESSAGE_CHARACTERS) return message;
  return `${message.slice(0, MAX_MESSAGE_CHARACTERS)}${TRUNCATION_MARK}`;
}

/**
 * The bounded tail this host will hand back about its own failures. Messages are redacted on the
 * way in, so no later reader can widen what the ring is able to disclose, and every entry carries
 * the correlation id of the request that produced it.
 */
export class DiagnosticLogRing {
  private readonly entries: DaemonLogEntry[] = [];

  constructor(private readonly capacity: number = DIAGNOSTIC_LOG_CAPACITY) {}

  record(correlationId: string | null, message: string): void {
    const redacted = redactLogText(message).trim();
    if (redacted === "") return;
    this.entries.push({
      at: new Date().toISOString(),
      correlation_id: correlationId,
      message: bounded(redacted),
    });
    const overflow = this.entries.length - this.capacity;
    if (overflow > 0) this.entries.splice(0, overflow);
  }

  /** Only what this correlation id produced: an unrelated tail would read as evidence it is not. */
  excerpt(correlationId: string, limit: number): DaemonLogExcerpt {
    const correlated = this.entries.filter((entry) => entry.correlation_id === correlationId);
    return {
      correlation_id: correlationId,
      truncated: correlated.length > limit,
      entries: correlated.slice(-limit),
    };
  }
}

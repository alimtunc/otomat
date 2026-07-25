import type { RotatingLog } from "./data-safety/index.js";
import { redactLogText } from "./data-safety/redaction.js";

const MAX_BUFFERED_CHARACTERS = 65_536;

/**
 * Desktop-side log sink that still works before the data directory exists: it
 * writes to the rotating log once there is one, and otherwise keeps a bounded
 * redacted buffer so the failure that prevented the directory is still
 * reportable in a support bundle.
 */
export class StartupLogSink {
  private buffered = "";
  private reportedFailure = false;

  constructor(private readonly target: () => RotatingLog | null) {}

  write(message: string): void {
    const log = this.target();
    if (log !== null) {
      try {
        log.write(message);
        return;
      } catch (error) {
        if (!this.reportedFailure) {
          this.reportedFailure = true;
          console.error("[otomat-desktop] desktop log write failed", error);
        }
      }
    }
    this.buffered = `${this.buffered}${redactLogText(message).trimEnd()}\n`.slice(
      -MAX_BUFFERED_CHARACTERS,
    );
  }

  read(): string {
    return this.buffered;
  }
}

import { statSync } from "node:fs";

import { ensureEventStream, type Db } from "@otomat/db";

import { runtimeEventSchema, type RuntimeEvent } from "#runtime";

import { appendEventStreamBatch, applyLedgerPragmas } from "./ledger.js";
import { readCompleteLinesFrom } from "./tail-source.js";

export interface EventTailerOptions {
  db: Db;
  runId: string;
  /** Stable durable identity of this file stream; defaults to the run control stream. */
  streamId?: string;
  filePath: string;
  busyTimeoutMs?: number;
}

export interface TailTickResult {
  /** New rows persisted this tick. */
  ingested: number;
  /** Bytes of `events.jsonl` consumed so far. */
  byteOffset: number;
}

/**
 * Non-lossy stream-to-file tailer. It ingests every line of a run's
 * `events.jsonl` into the ledger, coalescing whatever arrived since the last
 * tick into a single immediate transaction. Unlike a bounded in-memory ring
 * buffer, nothing is dropped under load — the
 * file itself is the backpressure. The resume position is derived from the DB on
 * (re)start, so a kill mid-stream replays from the last committed line with
 * neither loss nor duplication.
 */
export class EventTailer {
  private readonly db: Db;
  private readonly runId: string;
  private readonly streamId: string;
  private readonly filePath: string;
  private byteOffset = 0;
  private seeded = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: EventTailerOptions) {
    this.db = options.db;
    this.runId = options.runId;
    this.streamId = options.streamId ?? `run:${options.runId}:control`;
    this.filePath = options.filePath;
    applyLedgerPragmas(this.db, options.busyTimeoutMs);
  }

  /** Reads the new complete lines and ingests them as one batch. No-op when nothing is new. */
  tick(): TailTickResult {
    this.seed();

    let size: number;
    try {
      size = statSync(this.filePath).size;
    } catch {
      return this.idle(); // file not present yet
    }
    if (size < this.byteOffset) {
      throw new Error(
        `events.jsonl for run ${this.runId} shrank (size ${size} < offset ${this.byteOffset}); append-only contract violated`,
      );
    }

    const { lines, consumedBytes } = readCompleteLinesFrom(this.filePath, this.byteOffset);
    if (lines.length === 0) return this.idle();

    const events: RuntimeEvent[] = [];
    lines.forEach((line) => {
      const event = parseLine(line);
      if (event !== null) events.push(event);
    });

    const ingested = appendEventStreamBatch(this.db, this.runId, {
      streamId: this.streamId,
      filePath: this.filePath,
      fromByteOffset: this.byteOffset,
      consumedBytes,
      events,
    });
    this.byteOffset += consumedBytes;
    return { ingested, byteOffset: this.byteOffset };
  }

  /** Ticks until the file yields no further complete line. Returns the totals across the drain. */
  drain(): TailTickResult {
    let ingested = 0;
    for (;;) {
      const before = this.byteOffset;
      ingested += this.tick().ingested;
      if (this.byteOffset === before) {
        return { ingested, byteOffset: this.byteOffset };
      }
    }
  }

  /** Polls `tick()` on an interval. The daemon owns lifecycle; this is just the loop. */
  start(intervalMs: number): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private safeTick(): void {
    try {
      this.tick();
    } catch {
      // A failed tick leaves byteOffset unchanged, so the next interval retries
      // the same bytes; never let it escape and crash the host process.
    }
  }

  private seed(): void {
    if (this.seeded) return;
    const stream = ensureEventStream(this.db, {
      id: this.streamId,
      run_id: this.runId,
      file_path: this.filePath,
    });
    this.byteOffset = stream.byte_offset;
    this.seeded = true;
  }

  private idle(): TailTickResult {
    return { ingested: 0, byteOffset: this.byteOffset };
  }
}

function parseLine(line: string): RuntimeEvent | null {
  try {
    return runtimeEventSchema.parse(JSON.parse(line));
  } catch {
    return null;
  }
}

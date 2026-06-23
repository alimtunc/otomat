import { existsSync, statSync } from "node:fs";

import type { Db } from "@otomat/db";

import { runtimeEventSchema, type RuntimeEvent } from "#runtime";

import { appendSeqedEvents, applyLedgerPragmas, nextSeqForRun, type SeqedEvent } from "./ledger.js";
import { byteOffsetForLine, readCompleteLinesFrom } from "./tail-source.js";
import { type TailTickResult } from "./types.js";

export interface EventTailerOptions {
  db: Db;
  runId: string;
  /** Path to the run's `events.jsonl` (OTO-6 `JsonlEventSink` target). */
  filePath: string;
  busyTimeoutMs?: number;
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
  private readonly filePath: string;
  private byteOffset = 0;
  private nextSeq = 0;
  private seeded = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: EventTailerOptions) {
    this.db = options.db;
    this.runId = options.runId;
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

    // seq stays equal to the file line index: every line advances nextSeq, but a
    // corrupt line is skipped (leaving a gap) so one poison line can neither stall
    // the tail nor crash the host. The skipped seq is the signal it was dropped.
    const entries: SeqedEvent[] = [];
    lines.forEach((line, index) => {
      const event = parseLine(line);
      if (event !== null) entries.push({ event, seq: this.nextSeq + index });
    });

    const inserted = appendSeqedEvents(this.db, this.runId, entries);
    this.byteOffset += consumedBytes;
    this.nextSeq += lines.length;
    return { ingested: inserted, byteOffset: this.byteOffset, nextSeq: this.nextSeq };
  }

  /** Ticks until the file yields no further complete line. Returns the totals across the drain. */
  drain(): TailTickResult {
    let ingested = 0;
    for (;;) {
      const before = this.byteOffset;
      ingested += this.tick().ingested;
      if (this.byteOffset === before) {
        return { ingested, byteOffset: this.byteOffset, nextSeq: this.nextSeq };
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
    this.nextSeq = nextSeqForRun(this.db, this.runId);
    this.byteOffset = existsSync(this.filePath)
      ? byteOffsetForLine(this.filePath, this.nextSeq)
      : 0;
    this.seeded = true;
  }

  private idle(): TailTickResult {
    return { ingested: 0, byteOffset: this.byteOffset, nextSeq: this.nextSeq };
  }
}

function parseLine(line: string): RuntimeEvent | null {
  try {
    return runtimeEventSchema.parse(JSON.parse(line));
  } catch {
    return null;
  }
}

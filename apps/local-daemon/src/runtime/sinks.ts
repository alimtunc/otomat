import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";

import { runtimeEventSchema, type RuntimeEvent } from "./events.js";

/** Push target a runtime emits evidence into. `emit` is synchronous and must not await, so it never stalls the runtime's emit loop. */
export interface RuntimeSink {
  emit(event: RuntimeEvent): void;
}

/** In-memory sink for tests and integration: collects events in emission order. */
export class MemorySink implements RuntimeSink {
  readonly events: RuntimeEvent[] = [];

  emit(event: RuntimeEvent): void {
    this.events.push(event);
  }
}

/**
 * Appends each event as one JSON line to a run-dir `events.jsonl`. This is the
 * durable, non-lossy fixture the OTO-7 ledger ingests; OTO-7 allocates `seq`.
 */
export class JsonlEventSink implements RuntimeSink {
  private readonly fd: number;

  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.fd = openSync(path, "a");
  }

  emit(event: RuntimeEvent): void {
    writeSync(this.fd, `${JSON.stringify(event)}\n`);
  }

  close(): void {
    closeSync(this.fd);
  }
}

/** Fans one emission out to several sinks (e.g. caller sink + jsonl fixture). */
export function createTeeSink(sinks: readonly RuntimeSink[]): RuntimeSink {
  return {
    emit(event: RuntimeEvent): void {
      for (const sink of sinks) sink.emit(event);
    },
  };
}

/** Reads back an `events.jsonl`, validating every line against the contract. */
export function readEventsJsonl(path: string): RuntimeEvent[] {
  const text = readFileSync(path, "utf8");
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => runtimeEventSchema.parse(JSON.parse(line)));
}

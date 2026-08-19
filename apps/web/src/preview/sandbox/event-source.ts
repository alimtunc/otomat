import type { DaemonEventSource } from "@otomat/client";
import { sandboxRunEvents } from "@web/preview/sandbox/runs";
import { sandboxUrl } from "@web/preview/sandbox/url";

/** Slow enough to read as a live stream, fast enough that a whole fixture run lands in a couple of seconds. */
const FRAME_INTERVAL_MS = 400;

const RUN_EVENTS_PATH = /^\/api\/runs\/([^/]+)\/events$/;

function runIdFrom(url: string): string | null {
  return RUN_EVENTS_PATH.exec(sandboxUrl(url).pathname)?.[1] ?? null;
}

function afterSeqFrom(url: string): number {
  const parsed = Number(sandboxUrl(url).searchParams.get("afterSeq"));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

/**
 * Replays a fixture run's ledger as SSE frames, so the conversation, the timeline and the live
 * indicator behave in the sandbox exactly as they do against a daemon.
 */
export class SandboxEventSource implements DaemonEventSource {
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();
  private readonly frames: string[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(url: string) {
    const runId = runIdFrom(url);
    const afterSeq = afterSeqFrom(url);
    this.frames =
      runId === null
        ? []
        : sandboxRunEvents(runId)
            .filter((event) => event.seq > afterSeq)
            .map((event) => JSON.stringify(event));
    this.schedule(0);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).concat(listener));
  }

  close(): void {
    this.closed = true;
    if (this.timer !== null) clearTimeout(this.timer);
  }

  private schedule(index: number): void {
    this.timer = setTimeout(() => this.emit(index), index === 0 ? 0 : FRAME_INTERVAL_MS);
  }

  private emit(index: number): void {
    if (this.closed) return;
    if (index === 0) this.dispatch("open", null);
    const frame = this.frames[index];
    if (frame === undefined) {
      this.dispatch("end", JSON.stringify({ status: "completed" }));
      return;
    }
    this.dispatch("event", frame);
    this.schedule(index + 1);
  }

  private dispatch(type: string, data: string | null): void {
    const event = data === null ? new Event(type) : new MessageEvent(type, { data });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

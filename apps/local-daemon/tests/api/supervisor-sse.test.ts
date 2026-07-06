import { eventEnvelopeSchema, runEndPayloadSchema, type EventEnvelope } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp } from "../support/api.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

interface SseFrame {
  event: string;
  data: string;
}

function parseFrames(buffer: string): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    frames.push({ event, data });
  }
  return { frames, rest };
}

it(
  "streams a real run over the API and ends canceled after abort",
  { timeout: 20_000 },
  async () => {
    const { supervisor } = makeSupervisor(fix, "linger");
    const app = makeApiApp(fix, {
      launchRun: supervisor.start,
      resumeRun: supervisor.resume,
      fixRun: supervisor.fix,
      abortRun: supervisor.abort,
    });

    const started = await app.request("/api/runs", {
      method: "POST",
      headers: { Host: "127.0.0.1", "content-type": "application/json" },
      body: JSON.stringify({ prompt: "integration turn" }),
    });
    expect(started.status).toBe(201);
    const run = (await started.json()) as { id: string };

    const sse = await app.request(`/api/runs/${run.id}/events`, {
      headers: { Host: "127.0.0.1" },
    });
    expect(sse.status).toBe(200);
    const reader = sse.body?.getReader();
    if (!reader) throw new Error("SSE response has no body");

    const decoder = new TextDecoder();
    const events: EventEnvelope[] = [];
    let endStatus: string | null = null;
    let buffer = "";
    let aborted = false;

    while (endStatus === null) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = parseFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        if (frame.event === "event") events.push(eventEnvelopeSchema.parse(JSON.parse(frame.data)));
        if (frame.event === "end")
          endStatus = runEndPayloadSchema.parse(JSON.parse(frame.data)).status;
      }
      // Abort once the live tail surfaced events, so the stream can reach its terminal frame.
      if (!aborted && events.length >= 2) {
        aborted = true;
        const res = await app.request(`/api/runs/${run.id}/abort`, {
          method: "POST",
          headers: { Host: "127.0.0.1" },
        });
        expect(res.status).toBe(200);
      }
    }

    await supervisor.settle();

    expect(aborted).toBe(true);
    expect(endStatus).toBe("canceled");
    expect(events.length).toBeGreaterThanOrEqual(2);
    const seqs = events.map((e) => e.seq);
    expect(seqs).toEqual(seqs.toSorted((a, b) => a - b));
    expect(events.some((e) => e.type === "runtime.provider_session")).toBe(true);
  },
);

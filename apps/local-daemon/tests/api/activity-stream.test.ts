import { schema } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-streamed";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-activity-stream-");
  seedRun(t.db, {
    runId: RUN_ID,
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
});

afterEach(() => {
  t.cleanup();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

it(
  "sends the current snapshot, then a new one only once the activity changed",
  { timeout: 20_000 },
  async () => {
    const app = makeApiApp(t);
    const sse = await app.request("/api/activity/stream", { headers: { Host: "127.0.0.1" } });
    const reader = sse.body?.getReader();
    if (!reader) throw new Error("SSE response has no body");

    const decoder = new TextDecoder();
    let buffer = "";
    const snapshots = (): string[] => buffer.split("event: snapshot").slice(1);
    const drain = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
      }
    })();

    await delay(2_000);
    expect(snapshots()).toHaveLength(1);
    expect(buffer).toContain('"bucket":"running"');

    t.db.update(schema.runs).set({ status: "failed" }).where(eq(schema.runs.id, RUN_ID)).run();
    await delay(2_000);

    expect(snapshots()).toHaveLength(2);
    expect(buffer).toContain('"bucket":"attention"');

    await reader.cancel();
    await drain;
  },
);

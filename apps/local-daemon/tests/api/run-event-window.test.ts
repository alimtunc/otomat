import type { RunEventWindow } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedContiguousEvents } from "../support/ledger.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-window";

let t: TestDb;

function seedEvents(count: number, fromSeq = 0): void {
  seedContiguousEvents(t.db, RUN_ID, count, fromSeq);
}

async function readWindow(query: string): Promise<RunEventWindow> {
  const res = await request(makeApiApp(t), `/api/runs/${RUN_ID}/events/window${query}`);
  expect(res.status).toBe(200);
  return json<RunEventWindow>(res);
}

beforeEach(() => {
  t = setupTestDb("otomat-run-window-");
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

it("serves the newest page of a run's ledger with the cursor to the page above", async () => {
  seedEvents(8);
  const page = await readWindow("?limit=3");

  expect(page.run_id).toBe(RUN_ID);
  expect(page.events.map((event) => event.seq)).toEqual([5, 6, 7]);
  expect(page.older_cursor).toBe(5);
});

it("pages back from a cursor and closes on the ledger start", async () => {
  seedEvents(5);
  const older = await readWindow("?limit=3&before=2");

  expect(older.events.map((event) => event.seq)).toEqual([0, 1]);
  expect(older.older_cursor).toBeNull();
});

it("ignores a malformed cursor instead of refusing the read", async () => {
  seedEvents(2);
  const page = await readWindow("?before=not-a-seq");

  expect(page.events.map((event) => event.seq)).toEqual([0, 1]);
});

it("returns 404 for an unknown run rather than an empty window", async () => {
  const res = await request(makeApiApp(t), "/api/runs/does-not-exist/events/window");
  expect(res.status).toBe(404);
});

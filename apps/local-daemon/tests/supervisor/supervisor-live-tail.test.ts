import { getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("ingests events into the ledger while the child is still running (live tail)", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");

  const run = await supervisor.start({ prompt: "long running" });
  expect(run.status).toBe("running");

  // Without a live tailer these events would only reach the ledger at exit.
  const appeared = await waitFor(() => readRunEvents(fix.db, run.id).length >= 2);
  expect(appeared).toBe(true);
  expect(getRun(fix.db, run.id)?.status).toBe("running");

  await supervisor.abort(run.id);
  expect(getRun(fix.db, run.id)?.status).toBe("canceled");
});

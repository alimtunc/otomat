import { insertPullRequest, updatePullRequest } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-publishing";
const PR_ID = "pr-publishing";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-publication-stream-");
  seedRun(t.db, {
    runId: RUN_ID,
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  insertPullRequest(t.db, {
    id: PR_ID,
    issue_id: "i1",
    run_id: RUN_ID,
    publication_status: "pushing",
    title: "feat: ship it",
  });
});

afterEach(() => {
  t.cleanup();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

it(
  "keeps a settled run streaming while its publication is still running",
  { timeout: 20_000 },
  async () => {
    const app = makeApiApp(t);
    const sse = await app.request(`/api/runs/${RUN_ID}/events`, { headers: { Host: "127.0.0.1" } });
    const reader = sse.body?.getReader();
    if (!reader) throw new Error("SSE response has no body");

    let ended = false;
    const decoder = new TextDecoder();
    let buffer = "";
    const drained = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: end")) {
          ended = true;
          return;
        }
      }
    })();

    await delay(2_000);
    expect(ended).toBe(false);

    updatePullRequest(t.db, PR_ID, { publication_status: "created" });
    await Promise.race([drained, delay(5_000)]);

    expect(ended).toBe(true);
    await reader.cancel();
  },
);

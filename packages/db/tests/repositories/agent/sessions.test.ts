import { afterEach, beforeEach, expect, it } from "vitest";

import {
  insertAgentSession,
  listAgentSessionsForRun,
  recordSessionBoundaryError,
  recordSessionPassEnd,
  recordSessionPassStart,
} from "#db/repositories/agent/sessions";
import { insertIssue } from "#db/repositories/issues";
import { insertRun } from "#db/repositories/runs";
import { insertStepRun } from "#db/repositories/step-runs";
import { createTempDb, seedProject, type TempDb } from "#test-support/temp-db";

let t: TempDb;

function session() {
  return listAgentSessionsForRun(t.client.db, "r1")[0];
}

beforeEach(() => {
  t = createTempDb("otomat-agent-sessions-");
  seedProject(t.client.db);
  insertIssue(t.client.db, { id: "issue-r1", project_id: "p1", title: "Work", source: "local" });
  insertRun(t.client.db, {
    id: "r1",
    issue_id: "issue-r1",
    status: "running",
    branch: "otomat/run/r1",
    plan_json: { version: 1, steps: [] },
  });
  insertStepRun(t.client.db, { id: "r1-step", run_id: "r1", idx: 0, name: "Agent turn" });
  insertAgentSession(t.client.db, { id: "r1-session", step_run_id: "r1-step" });
});

afterEach(() => {
  t.cleanup();
});

it("keeps the first start boundary when a resumed turn captures again", () => {
  recordSessionPassStart(t.client.db, "r1-session", { treeSha: "tree-1", headSha: "head-1" });
  recordSessionPassEnd(t.client.db, "r1-session", { treeSha: "tree-2", headSha: "head-2" });

  recordSessionPassStart(t.client.db, "r1-session", { treeSha: "tree-3", headSha: "head-3" });
  recordSessionPassEnd(t.client.db, "r1-session", { treeSha: "tree-4", headSha: "head-4" });

  // A resume reuses its session row; moving the start would drop the first turn out of the pass delta.
  expect(session()?.start_tree_sha).toBe("tree-1");
  expect(session()?.start_head_sha).toBe("head-1");
  expect(session()?.end_tree_sha).toBe("tree-4");
});

it("captures a start boundary a failed first attempt never recorded", () => {
  recordSessionBoundaryError(t.client.db, "r1-session", "the repository could not be read");
  expect(session()?.start_tree_sha).toBeNull();

  recordSessionPassStart(t.client.db, "r1-session", { treeSha: "tree-1", headSha: "head-1" });

  expect(session()?.start_tree_sha).toBe("tree-1");
  expect(session()?.boundary_error).toBeNull();
});

import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RunPlan } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createClient, type DbClient } from "#db/client";
import { schema } from "#db/index";
import { runMigrations } from "#db/migrate";
import { getIssue, insertIssue } from "#db/repositories/issues";
import { getRun, insertRun } from "#db/repositories/runs";

let dbPath = "";
let client: DbClient;

beforeEach(() => {
  dbPath = join(tmpdir(), `otomat-repo-${process.pid}-${process.hrtime.bigint()}.db`);
  runMigrations(dbPath);
  client = createClient(dbPath);
});

afterEach(() => {
  client.sqlite.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

it("round-trips an issue with external-mirror columns", () => {
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: "/tmp/p" }).run();
  insertIssue(client.db, {
    id: "i1",
    project_id: "p1",
    title: "Foundation",
    body: null,
    status: "backlog",
    source: "linear",
    source_external_id: "OTO-5",
    synced_at: "2026-06-18T00:00:00.000Z",
  });

  const issue = getIssue(client.db, "i1");
  expect(issue?.source).toBe("linear");
  expect(issue?.source_external_id).toBe("OTO-5");
  expect(issue?.synced_at).toBe("2026-06-18T00:00:00.000Z");
});

it("stores and parses the frozen run plan_json", () => {
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: "/tmp/p" }).run();
  insertIssue(client.db, {
    id: "i1",
    project_id: "p1",
    title: "Foundation",
    source: "local",
  });

  const plan: RunPlan = {
    version: 1,
    steps: [{ id: "s1", name: "scaffold", agent: null, prompt: null, depends_on: [] }],
  };
  insertRun(client.db, {
    id: "r1",
    issue_id: "i1",
    status: "queued",
    branch: "alimtunc/oto-5",
    plan_json: plan,
  });

  const run = getRun(client.db, "r1");
  expect(run?.plan_json).toEqual(plan);
});

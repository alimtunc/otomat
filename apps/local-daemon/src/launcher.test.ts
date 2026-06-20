import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, getRun, listIssues, runMigrations, type Db } from "@otomat/db";
import { readRunEvents } from "@otomat/events";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ensureDefaultProject } from "./bootstrap.js";
import { createRunLauncher } from "./launcher.js";

let dbPath = "";
let dataDir = "";
let db: Db;
let close: () => void;

beforeEach(() => {
  const id = randomUUID();
  dbPath = join(tmpdir(), `otomat-daemon-${id}.db`);
  dataDir = join(tmpdir(), `otomat-daemon-${id}`);
  runMigrations(dbPath);
  const client = createClient(dbPath);
  db = client.db;
  close = () => client.sqlite.close();
});

afterEach(() => {
  close();
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${dbPath}${suffix}`, { force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

it("launches a fake run from a prompt, persisting events and a terminal state", async () => {
  const projectId = ensureDefaultProject(db, "/tmp/repo");
  const launcher = createRunLauncher({ db, dataDir, defaultProjectId: projectId });

  const run = await launcher.launchRun({ prompt: "implement the thing" });
  expect(run.status).toBe("running");

  await launcher.settle();

  const persisted = getRun(db, run.id);
  expect(persisted?.status).toBe("completed");
  expect(persisted?.completed_at).toBeTruthy();

  const events = readRunEvents(db, run.id);
  expect(events.length).toBeGreaterThan(0);
  expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index));

  const issues = listIssues(db);
  expect(issues).toHaveLength(1);
  expect(issues[0].title).toBe("implement the thing");
});

it("reuses an existing issue when issue_id is provided", async () => {
  const projectId = ensureDefaultProject(db, "/tmp/repo");
  const launcher = createRunLauncher({ db, dataDir, defaultProjectId: projectId });

  const first = await launcher.launchRun({ prompt: "seed issue" });
  await launcher.settle();
  const issueId = getRun(db, first.id)?.issue_id ?? "";
  expect(issueId).not.toBe("");

  const second = await launcher.launchRun({ issue_id: issueId });
  await launcher.settle();

  expect(getRun(db, second.id)?.issue_id).toBe(issueId);
  expect(listIssues(db)).toHaveLength(1);
});

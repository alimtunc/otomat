import { getRun, insertPullRequest, listAgentSessionsForRun, schema } from "@otomat/db";
import { executableSteps, sessionContextSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { AppendStepInput } from "#supervisor";

import { contributeToStep } from "../support/contribution.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { firstStepOf } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({ id: "i-work", project_id: "p1", title: "Continue me", status: "ready" })
    .run();
});

afterEach(() => {
  fix.cleanup();
});

const APPENDED: AppendStepInput = {
  name: "Address the review",
  note: "rename beta",
  references: [],
  selector: { kind: "runtime", runtimeId: "fake" },
  overrides: {},
  dependsOn: [],
  replaces: null,
  origin: "user",
};

const LATE_PULL_REQUEST = {
  id: "pr-late",
  issue_id: "i-work",
  repository_id: "repo-1",
  number: 133,
  url: "https://github.com/acme/app/pull/133",
  status: "open",
  publication_status: "created",
  title: "Adopt external pull requests",
  head_ref: "feat/adopt-external-pull-requests",
  base_ref: "main",
  published_head_sha: "a".repeat(40),
} as const;

it("freezes a new dated context for an appended step rather than reusing the launch's", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work", note: "start here" });
  await supervisor.settle();

  await supervisor.appendStep(run.id, APPENDED);
  await supervisor.settle();

  const steps = executableSteps(getRun(fix.db, run.id)?.plan_json ?? { version: 1, steps: [] });
  const [launched, appended] = steps;
  expect(launched?.context?.note).toBe("start here");
  expect(appended?.context?.note).toBe("rename beta");
  expect(appended?.context?.issue?.title).toBe("Continue me");
  expect(appended?.context?.captured_at).not.toBe(launched?.context?.captured_at);

  const contexts = listAgentSessionsForRun(fix.db, run.id).map((session) =>
    sessionContextSchema.parse(session.context_json),
  );
  expect(contexts).toHaveLength(2);
  expect(contexts[1]?.progress?.step_name).toBe("Address the review");
  expect(spawn.jobs[1]?.prompt).toContain("rename beta");
});

it("gives a recovery session a fresh dossier plus why it exists, and no repeated issue prose", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["fail", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work", note: "start here" });
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("failed");

  // A lost provider session is what leaves a recovery as the only way back in.
  fix.db.update(schema.agentSessions).set({ provider_session_id: null }).run();
  expect(supervisor.resumePlan(run.id)).toMatchObject({ mode: "recovery" });

  await supervisor.resume(run.id);
  await supervisor.settle();

  const sessions = listAgentSessionsForRun(fix.db, run.id);
  expect(sessions).toHaveLength(2);
  const recovery = sessionContextSchema.parse(sessions[1]?.context_json);
  expect(recovery.selection.issue?.title).toBe("Continue me");
  expect(recovery.selection.note).toBe("start here");

  const prompt = spawn.jobs[1]?.prompt ?? "";
  expect(prompt).toContain("stopped before finishing");
  // The dossier states the issue once; the recovery brief adds only what is specific to it.
  expect(prompt.split("Continue me")).toHaveLength(2);
});

it("keeps a native resume on the dossier its own session was given", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["crash", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work", note: "start here" });
  await supervisor.settle();
  expect(supervisor.resumePlan(run.id)).toEqual({ mode: "native" });

  await supervisor.resume(run.id);
  await supervisor.settle();

  const sessions = listAgentSessionsForRun(fix.db, run.id);
  expect(sessions).toHaveLength(1);
  expect(spawn.jobs[1]?.mode).toBe("resume");
  // A reattached provider still holds the conversation; re-sending the context would contradict it.
  expect(spawn.jobs[1]?.prompt).not.toContain("# Working context");
  expect(spawn.jobs[1]?.prompt).toContain("continue");
});

it("keeps every context field local, so an imported issue needs no tracker call", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  fix.db
    .insert(schema.issues)
    .values({
      id: "i-linear",
      project_id: "p1",
      title: "Imported work",
      body: "Described in Linear.",
      status: "ready",
      source: "linear",
      source_external_id: "lin-42",
      source_identifier: "OTO-42",
      source_url: "https://linear.app/otomat/issue/OTO-42",
      synced_at: "2026-08-13T00:00:00.000Z",
    })
    .run();

  const run = await supervisor.start({ issue_id: "i-linear" });
  await supervisor.settle();

  const [session] = listAgentSessionsForRun(fix.db, run.id);
  const serialized = JSON.stringify(session?.context_json);
  expect(serialized).toContain("Described in Linear.");
  expect(serialized).not.toContain("lin-42");
  expect(serialized).not.toContain("linear.app");
  expect(spawn.jobs[0]?.prompt).toContain("do not call an issue tracker");
});

it("hands a reattached session the pull request its own dossier never saw", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["crash", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work", note: "start here" });
  await supervisor.settle();
  insertPullRequest(fix.db, { ...LATE_PULL_REQUEST, run_id: run.id });

  await supervisor.resume(run.id);
  await supervisor.settle();

  const prompt = spawn.jobs[1]?.prompt ?? "";
  expect(prompt).toContain("#133 Adopt external pull requests (open)");
  expect(prompt).toContain("head branch: feat/adopt-external-pull-requests → base branch: main");
  expect(prompt).toContain(`published head: ${"a".repeat(40)}`);
  expect(prompt).toContain("https://github.com/acme/app/pull/133");
  expect(prompt).toContain("never push another remote branch");
  expect(prompt).toContain("continue");
  expect(prompt).toContain(`The workspace keeps its own branch ${run.branch}`);
  expect(getRun(fix.db, run.id)?.branch).toBe(run.branch);
  expect(
    sessionContextSchema.parse(listAgentSessionsForRun(fix.db, run.id)[0]?.context_json)
      .pull_request,
  ).toBeNull();
});

it("carries the same pull request into a message delivered to that session", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  insertPullRequest(fix.db, { ...LATE_PULL_REQUEST, run_id: run.id });

  await contributeToStep(
    fix.db,
    supervisor,
    run.id,
    firstStepOf(fix.db, run.id),
    "address the review",
  );
  await supervisor.settle();

  const prompt = spawn.jobs[1]?.prompt ?? "";
  expect(prompt).toContain("feat/adopt-external-pull-requests");
  expect(prompt).toContain("address the review");
});

it("says nothing further when the publication has not moved since the dossier", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "crash", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  insertPullRequest(fix.db, { ...LATE_PULL_REQUEST, run_id: run.id });

  await supervisor.appendStep(run.id, APPENDED);
  await supervisor.settle();
  expect(spawn.jobs[1]?.prompt).toContain("feat/adopt-external-pull-requests");

  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(spawn.jobs[2]?.mode).toBe("resume");
  expect(spawn.jobs[2]?.prompt).not.toContain("# Publication update");
});

it("leaves a pull request adopted for the issue out of the run's delta", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["crash", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  // Adoption binds a pull request to the issue, never to a run: Otomat owns no branch there to update.
  insertPullRequest(fix.db, {
    ...LATE_PULL_REQUEST,
    run_id: null,
    origin: "imported",
    provenance: "external",
  });

  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(spawn.jobs[1]?.prompt).not.toContain("# Publication update");
});

import { getRun, listAgentSessionsForRun, schema } from "@otomat/db";
import { executableSteps, sessionContextSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { AppendStepInput } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
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
  origin: "user",
};

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

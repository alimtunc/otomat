import { getRun, listAgentSessionsForRun, schema } from "@otomat/db";
import { executableSteps, sessionContextSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { toRun } from "#api/serialize";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({
      id: "OTO-1",
      project_id: "p1",
      title: "Ship the CSV parser",
      body: "Quoting breaks on nested commas.",
      status: "ready",
      source: "linear",
      source_external_id: "lin-1",
      source_identifier: "OTO-1",
      source_url: "https://linear.app/otomat/issue/OTO-1",
      synced_at: "2026-08-13T00:00:00.000Z",
      source_labels: [{ name: "bug", color: "#f00" }],
      source_state_name: "In Progress",
    })
    .run();
  fix.repo.write("src/parser.ts", "export const parse = () => 1;\n");
  fix.repo.commitAll("add the parser");
  fix.repo.git("push", "--quiet", "origin", "main");
});

afterEach(() => {
  fix.cleanup();
});

function planStep(runId: string, index = 0) {
  const step = executableSteps(getRun(fix.db, runId)?.plan_json ?? { version: 1, steps: [] })[
    index
  ];
  if (!step) throw new Error(`no plan step at ${index}`);
  return step;
}

it("attaches the issue snapshot to a single run without any editable prompt", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "OTO-1" });
  await supervisor.settle();

  const frozen = planStep(run.id);
  expect(frozen.prompt).toBeNull();
  expect(frozen.context?.issue).toMatchObject({
    id: "OTO-1",
    identifier: "OTO-1",
    title: "Ship the CSV parser",
    body: "Quoting breaks on nested commas.",
    labels: ["bug"],
    source_state_name: "In Progress",
  });
  expect(frozen.context?.note).toBeNull();

  const prompt = spawn.jobs[0]?.prompt ?? "";
  expect(prompt).toContain("Quoting breaks on nested commas.");
  // Nothing an agent could call the tracker with rides along.
  expect(prompt).not.toContain("https://linear.app");
  expect(prompt).not.toContain("lin-1");
  expect(prompt).not.toContain("# Step instructions");
});

it("freezes an attached file's content, and names a path it refuses", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({
    issue_id: "OTO-1",
    note: "keep the public API stable",
    context: [
      { kind: "file", path: "src/parser.ts" },
      { kind: "file", path: "../escape.ts" },
    ],
  });
  await supervisor.settle();

  const frozen = planStep(run.id);
  expect(frozen.context?.note).toBe("keep the public API stable");
  expect(frozen.context?.files).toEqual([
    {
      state: "read",
      path: "src/parser.ts",
      bytes: 30,
      text: "export const parse = () => 1;\n",
    },
    { state: "unavailable", path: "../escape.ts", reason: "outside_repository" },
  ]);
});

it("keeps the frozen file content out of the plan the API serves", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({
    issue_id: "OTO-1",
    context: [{ kind: "file", path: "src/parser.ts" }],
  });
  await supervisor.settle();

  // The freeze is durable; the served plan carries its shape, and the dossier its content.
  expect(planStep(run.id).context?.files[0]).toMatchObject({ state: "read" });
  expect(JSON.stringify(toRun(getRun(fix.db, run.id)!))).not.toContain("export const parse");
});

it("records the dossier each session was given, with the cycle's own state", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "OTO-1", note: "start here" });
  await supervisor.settle();

  const [session] = listAgentSessionsForRun(fix.db, run.id);
  const context = sessionContextSchema.parse(session?.context_json);
  expect(context.selection.issue?.title).toBe("Ship the CSV parser");
  expect(context.selection.note).toBe("start here");
  expect(context.workspace?.branch).toBe(run.branch);
  expect(context.workspace?.base_branch).toBe("main");
  expect(context.progress?.step_name).toBe("Agent turn");
  expect(context.pull_request).toBeNull();
  expect(Date.parse(context.captured_at)).not.toBeNaN();
});

it("hands a dependent step its predecessor's report and the accumulated diff", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({
    issue_id: "OTO-1",
    plan: {
      version: 1,
      steps: [
        { id: "build", name: "Build", agent: null, note: "write it", depends_on: [] },
        { id: "review", name: "Review", agent: null, depends_on: ["build"] },
      ],
    },
  });
  await supervisor.settle();

  // A step with no note of its own still receives the issue, the plan and what it waits on.
  expect(planStep(run.id, 1).context?.note).toBeNull();
  const reviewPrompt = spawn.jobs[1]?.prompt ?? "";
  expect(reviewPrompt).toContain("Ship the CSV parser");
  expect(reviewPrompt).toContain("- Build: succeeded ← this step depends on it");
  expect(reviewPrompt).not.toContain("write it");
  expect(reviewPrompt).not.toContain("# Step instructions");
});

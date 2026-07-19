import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  claimCompeteWinner,
  getRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  schema,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { createSupervisor, type SpawnSession } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { anchorProjectRoot, seedRepository } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { providerSessionEvent, writeRunEvents } from "../support/run-event-fixtures.js";
import { deadPid, workerSpawn } from "../support/spawn.js";

let fix: DaemonTestDb;
let repo: TestRepo;

beforeEach(() => {
  fix = setupDaemonDb();
  repo = setupTestRepo();
  anchorProjectRoot(fix.db, repo.root);
  seedRepository(fix.db, repo.defaultBranch);
});

afterEach(() => {
  repo.cleanup();
  fix.cleanup();
});

const COMPETE_PLAN = {
  version: 1 as const,
  steps: [
    {
      id: "approach",
      name: "Choose an approach",
      depends_on: [],
      compete: [
        { id: "direct", name: "Direct", agent: "fake", prompt: "direct" },
        { id: "layered", name: "Layered", agent: "fake", prompt: "layered" },
      ],
    },
    {
      id: "verify",
      name: "Verify",
      agent: "fake",
      prompt: "verify",
      depends_on: ["approach"],
    },
  ],
};

function makeCompeteSupervisor(behavior: Parameters<typeof workerSpawn>[0] = "complete"): {
  supervisor: ReturnType<typeof createSupervisor>;
  spawn: ReturnType<typeof workerSpawn>;
} {
  const worker = workerSpawn(behavior);
  const spawn = ((job) => {
    if (job.prompt !== "verify" && job.worktreePath) {
      writeFileSync(join(job.worktreePath, "choice.txt"), `${job.prompt}\n`);
    }
    return worker(job);
  }) as SpawnSession & { calls: number; jobs: typeof worker.jobs };
  Object.defineProperties(spawn, {
    calls: { get: () => worker.calls },
    jobs: { get: () => worker.jobs },
  });
  return {
    supervisor: createSupervisor({
      db: fix.db,
      dataDir: fix.dataDir,
      defaultProjectId: "p1",
      spawn,
      concurrency: 2,
      repositories: createRepositoryResolver({
        db: fix.db,
        worktreesRoot: join(fix.dataDir, "worktrees"),
      }),
    }),
    spawn,
  };
}

it("runs competitors in isolated worktrees, waits for a winner, then continues on canonical", async () => {
  const { supervisor, spawn } = makeCompeteSupervisor();

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_selection");
  expect(spawn.calls).toBe(2);
  expect(new Set(spawn.jobs.map((job) => job.worktreePath)).size).toBe(2);

  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  expect(group?.status).toBe("awaiting_selection");
  const candidates = listStepRunsForRun(fix.db, run.id).filter(
    (step) => step.compete_group_id === group?.id,
  );
  expect(candidates.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
  expect(candidates.every((step) => step.worktree_id !== null)).toBe(true);
  const dependent = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Verify");
  expect(dependent?.status).toBe("queued");

  const winner = candidates.find((step) => step.name === "Layered");
  if (!group || !winner) throw new Error("expected frozen compete group");
  await supervisor.selectWinner(run.id, group.id, winner.id);
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]).toMatchObject({
    status: "selected",
    winner_step_run_id: winner.id,
  });
  expect(spawn.calls).toBe(3);
  expect(spawn.jobs[2]?.prompt).toBe("verify");
  expect(spawn.jobs[2]?.worktreePath).not.toBe(spawn.jobs[0]?.worktreePath);
  expect(spawn.jobs[2]?.worktreePath).not.toBe(spawn.jobs[1]?.worktreePath);
  expect(readFileSync(join(spawn.jobs[2]?.worktreePath ?? "", "choice.txt"), "utf8")).toBe(
    "layered\n",
  );

  for (const candidate of candidates) {
    const job = spawn.jobs.find((entry) => entry.stepRunId === candidate.id);
    expect(existsSync(job?.worktreePath ?? "")).toBe(false);
  }
  expect(
    fix.db
      .select()
      .from(schema.worktrees)
      .all()
      .filter((worktree) => candidates.some((candidate) => candidate.worktree_id === worktree.id)),
  ).toSatisfy((worktrees: Array<{ status: string }>) =>
    worktrees.every((worktree) => worktree.status === "archived"),
  );
});

it("resumes only interrupted competitors after an explicit action", async () => {
  const { supervisor, spawn } = makeCompeteSupervisor(["crash", "crash", "complete", "complete"]);

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  expect(spawn.calls).toBe(2);
  const originalSessions = new Set(spawn.jobs.map((job) => job.agentSessionId));

  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_selection");
  expect(spawn.calls).toBe(4);
  expect(spawn.jobs.slice(2).every((job) => job.mode === "resume")).toBe(true);
  expect(spawn.jobs.slice(2).every((job) => originalSessions.has(job.agentSessionId))).toBe(true);
  expect(new Set(spawn.jobs.slice(2).map((job) => job.worktreePath)).size).toBe(2);
});

it("fails only after every competitor has halted and cancels blocked dependents", async () => {
  const { supervisor } = makeCompeteSupervisor("fail");

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]?.status).toBe("failed");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.filter((step) => step.compete_group_id !== null).map((step) => step.status)).toEqual(
    ["stale", "stale"],
  );
  expect(steps.find((step) => step.compete_group_id === null)?.status).toBe("canceled");
});

it("reconciles every torn competitor without auto-spawning, then resumes explicitly", async () => {
  const refs = [
    { runId: "crash-run", stepRunId: "candidate-a", agentSessionId: "session-a" },
    { runId: "crash-run", stepRunId: "candidate-b", agentSessionId: "session-b" },
  ];
  fix.db
    .insert(schema.runs)
    .values({
      id: "crash-run",
      issue_id: "i1",
      status: "running",
      branch: "otomat/run/crash",
      plan_json: {
        version: 1,
        steps: [
          {
            id: "group",
            name: "Compete",
            depends_on: [],
            compete: [
              { id: "candidate-a", name: "A", agent: "fake", prompt: "a" },
              { id: "candidate-b", name: "B", agent: "fake", prompt: "b" },
            ],
          },
        ],
      },
    })
    .run();
  fix.db
    .insert(schema.competeGroups)
    .values({ id: "group", run_id: "crash-run", idx: 0, name: "Compete", status: "running" })
    .run();
  fix.db
    .insert(schema.stepRuns)
    .values(
      refs.map((ref, index) => ({
        id: ref.stepRunId,
        run_id: ref.runId,
        idx: index,
        name: index === 0 ? "A" : "B",
        status: "running" as const,
        compete_group_id: "group",
      })),
    )
    .run();
  fix.db
    .insert(schema.agentSessions)
    .values(
      await Promise.all(
        refs.map(async (ref) => ({
          id: ref.agentSessionId,
          step_run_id: ref.stepRunId,
          agent_id: null,
          status: "active" as const,
          pid: await deadPid(),
        })),
      ),
    )
    .run();
  writeRunEvents(fix.dataDir, "crash-run", [
    providerSessionEvent(refs[0]!, "provider-a"),
    providerSessionEvent(refs[1]!, "provider-b"),
  ]);
  const worker = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn: worker,
    concurrency: 2,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
  });

  const report = supervisor.reconcile();

  expect(report.reconciled).toHaveLength(2);
  expect(worker.calls).toBe(0);
  expect(getRun(fix.db, "crash-run")?.status).toBe("awaiting_human");
  expect(listStepRunsForRun(fix.db, "crash-run").map((step) => step.status)).toEqual([
    "awaiting_human",
    "awaiting_human",
  ]);

  await supervisor.resume("crash-run");
  await supervisor.settle();
  expect(worker.calls).toBe(2);
  expect(getRun(fix.db, "crash-run")?.status).toBe("awaiting_selection");
});

it("finishes a reserved promotion after restart without auto-running dependents", async () => {
  const first = makeCompeteSupervisor();
  const run = await first.supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await first.supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const winner = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Direct");
  if (!group || !winner) throw new Error("expected winner candidate");
  claimCompeteWinner(fix.db, group.id, winner.id);

  const restarted = makeCompeteSupervisor();
  const report = restarted.supervisor.reconcile();

  expect(report.reconciled).toHaveLength(1);
  expect(restarted.spawn.calls).toBe(0);
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]).toMatchObject({
    status: "selected",
    winner_step_run_id: winner.id,
  });
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");

  await restarted.supervisor.resume(run.id);
  await restarted.supervisor.settle();
  expect(restarted.spawn.calls).toBe(1);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("reserves exactly one winner when two selections race", async () => {
  const { supervisor } = makeCompeteSupervisor();
  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const candidates = listStepRunsForRun(fix.db, run.id).filter(
    (step) => step.compete_group_id === group?.id,
  );
  if (!group || candidates.length !== 2) throw new Error("expected two competitors");

  const settled = await Promise.allSettled([
    supervisor.selectWinner(run.id, group.id, candidates[0]!.id),
    supervisor.selectWinner(run.id, group.id, candidates[1]!.id),
  ]);

  expect(settled.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(settled.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]?.winner_step_run_id).toBe(candidates[0]!.id);
  await supervisor.settle();
});

it("keeps follow-up turns on the selected provider session and canonical worktree", async () => {
  const { supervisor, spawn } = makeCompeteSupervisor();
  const groupOnlyPlan = { ...COMPETE_PLAN, steps: [COMPETE_PLAN.steps[0]!] };
  const run = await supervisor.start({ prompt: "the goal", plan: groupOnlyPlan });
  await supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const winner = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Direct");
  if (!group || !winner) throw new Error("expected winner candidate");

  await supervisor.selectWinner(run.id, group.id, winner.id);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  const winnerJob = spawn.jobs.find((job) => job.stepRunId === winner.id);

  await supervisor.followUp(run.id, "refine the winner");
  await supervisor.settle();

  expect(spawn.jobs.at(-1)).toMatchObject({
    mode: "resume",
    stepRunId: winner.id,
    agentSessionId: winnerJob?.agentSessionId,
    prompt: "refine the winner",
  });
  expect(spawn.jobs.at(-1)?.worktreePath).not.toBe(winnerJob?.worktreePath);
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]?.status).toBe("selected");
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

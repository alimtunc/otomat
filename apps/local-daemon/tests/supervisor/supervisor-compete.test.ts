import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  claimCompeteWinner,
  getRun,
  listCompeteGroupsForRun,
  listRunContributions,
  listStepRunsForRun,
  schema,
  updateRepositoryInitCommands,
  writeMaxConcurrentSessions,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createRepositoryResolver, type RepositoryResolver } from "#git";
import { createSupervisor, RunNotResumableError } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { providerSessionEvent, writeRunEvents } from "../support/run-event-fixtures.js";
import { deadPid, workerSpawn } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
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
        { id: "direct", name: "Direct", agent: "fake", note: "direct" },
        { id: "layered", name: "Layered", agent: "fake", note: "layered" },
      ],
    },
    {
      id: "verify",
      name: "Verify",
      agent: "fake",
      note: "verify",
      depends_on: ["approach"],
    },
  ],
};

const UNAVAILABLE_REPOSITORIES: RepositoryResolver = {
  worktreesRoot: "/tmp/otomat-unavailable-worktrees",
  forProject: () => null,
  forRepository: () => null,
  forRun: () => null,
};

function makeCompeteSupervisor(
  behavior: Parameters<typeof workerSpawn>[0] = "complete",
  onJob?: (job: Parameters<ReturnType<typeof workerSpawn>>[0]) => void,
): {
  supervisor: ReturnType<typeof createSupervisor>;
  spawn: ReturnType<typeof workerSpawn>;
} {
  const worker = workerSpawn(behavior);
  const spawn = (job: Parameters<typeof worker>[0]) => {
    onJob?.(job);
    if (!job.prompt.endsWith("verify") && job.worktreePath) {
      const choice = job.prompt.endsWith("layered") ? "layered" : "direct";
      writeFileSync(join(job.worktreePath, "choice.txt"), `${choice}\n`);
    }
    return worker(job);
  };
  writeMaxConcurrentSessions(fix.db, 2);
  return {
    supervisor: createSupervisor({
      db: fix.db,
      dataDir: fix.dataDir,
      defaultProjectId: "p1",
      spawn,
      repositories: createRepositoryResolver({
        db: fix.db,
        worktreesRoot: join(fix.dataDir, "worktrees"),
      }),
    }),
    spawn: worker,
  };
}

it("runs competitors in isolated worktrees, waits for a winner, then continues on canonical", async () => {
  const { supervisor, spawn } = makeCompeteSupervisor();

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_selection");
  expect(spawn.calls).toBe(2);
  expect(new Set(spawn.jobs.map((job) => job.worktreePath)).size).toBe(2);
  // A group's name is a label, never an instruction: each candidate gets only its own note.
  expect(spawn.jobs.map((job) => job.prompt.split("# Step instructions\n")[1])).toEqual([
    "direct",
    "layered",
  ]);
  expect(spawn.jobs.every((job) => !job.prompt.includes("Choose an approach\n\n"))).toBe(true);

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
  expect(spawn.jobs[2]?.prompt.endsWith("verify")).toBe(true);
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

it("initializes every candidate worktree before its agent starts", async () => {
  updateRepositoryInitCommands(fix.db, "repo-1", ["touch init-marker"]);
  const markerAtSpawn = new Map<string, boolean>();
  const { supervisor, spawn } = makeCompeteSupervisor("complete", (job) => {
    markerAtSpawn.set(job.stepRunId, existsSync(join(job.worktreePath, "init-marker")));
  });

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_selection");
  expect(spawn.calls).toBe(2);
  expect(markerAtSpawn.size).toBe(2);
  expect([...markerAtSpawn.values()]).toEqual([true, true]);

  const texts = readRunEvents(fix.db, run.id)
    .filter((event) => event.type === "runtime.log")
    .map((event) => (event.payload as { text?: string }).text ?? "");
  expect(texts).toContain("[otomat] worktree init: $ touch init-marker");
  expect(texts).toContain("[otomat] worktree init [Direct]: $ touch init-marker");
  expect(texts).toContain("[otomat] worktree init [Layered]: $ touch init-marker");
});

it("fails only the candidate whose init fails, keeping the group selectable", async () => {
  // The canonical worktree always initializes before any candidate, so the sentinel marks it; candidates then race for the atomic mkdir and exactly one init fails.
  const sentinel = join(fix.dataDir, "canonical-init-done");
  const gate = join(fix.dataDir, "init-gate");
  updateRepositoryInitCommands(fix.db, "repo-1", [
    `[ -e "${sentinel}" ] || { touch "${sentinel}"; exit 0; }; mkdir "${gate}" 2>/dev/null || exit 7`,
  ]);
  const { supervisor, spawn } = makeCompeteSupervisor();

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_selection");
  expect(spawn.calls).toBe(1);
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  expect(group?.status).toBe("awaiting_selection");
  const candidates = listStepRunsForRun(fix.db, run.id).filter(
    (step) => step.compete_group_id === group?.id,
  );
  expect(candidates.map((step) => step.status).toSorted()).toEqual(["stale", "succeeded"]);

  const winner = candidates.find((step) => step.status === "succeeded");
  if (!group || !winner) throw new Error("expected a selectable compete group");
  await supervisor.selectWinner(run.id, group.id, winner.id);
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(spawn.calls).toBe(2);
});

it("fails the run when every candidate's init fails, never spawning an agent", async () => {
  // The canonical init passes and plants the sentinel; every candidate init then sees it and fails.
  const sentinel = join(fix.dataDir, "canonical-init-done");
  updateRepositoryInitCommands(fix.db, "repo-1", [
    `[ ! -e "${sentinel}" ] || exit 3`,
    `touch "${sentinel}"`,
  ]);
  const { supervisor, spawn } = makeCompeteSupervisor();

  const run = await supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  expect(spawn.calls).toBe(0);
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]?.status).toBe("failed");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.filter((step) => step.compete_group_id !== null).map((step) => step.status)).toEqual(
    ["stale", "stale"],
  );
  expect(steps.find((step) => step.compete_group_id === null)?.status).toBe("canceled");
});

it("rejects a compete launch before writing rows when the project has no repository", async () => {
  fix.db
    .insert(schema.projects)
    .values({ id: "p-no-repo", name: "No repository", root_path: fix.dataDir })
    .run();
  fix.db
    .insert(schema.issues)
    .values({ id: "i-no-repo", project_id: "p-no-repo", title: "Compete without Git" })
    .run();
  const { supervisor } = makeCompeteSupervisor();

  await expect(
    supervisor.start({ issue_id: "i-no-repo", plan: COMPETE_PLAN }),
  ).rejects.toMatchObject({ name: "LaunchRefusedError", code: "repository_required" });
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.stepRuns).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.competeGroups).all()).toHaveLength(0);
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

it("reconciles torn competitors but refuses to resume them without repository worktrees", async () => {
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
  const { supervisor, spawn: worker } = makeSupervisor(fix, "complete", { concurrency: 2 });

  const report = supervisor.reconcile();

  expect(report.reconciled).toHaveLength(2);
  expect(worker.calls).toBe(0);
  expect(getRun(fix.db, "crash-run")?.status).toBe("awaiting_human");
  expect(listStepRunsForRun(fix.db, "crash-run").map((step) => step.status)).toEqual([
    "awaiting_human",
    "awaiting_human",
  ]);

  await expect(supervisor.resume("crash-run")).rejects.toBeInstanceOf(RunNotResumableError);
  expect(worker.calls).toBe(0);
  expect(getRun(fix.db, "crash-run")?.status).toBe("awaiting_human");
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

  const { supervisor: blocked, spawn: blockedSpawn } = makeSupervisor(fix, "complete", {
    repositories: UNAVAILABLE_REPOSITORIES,
  });
  await expect(blocked.resume(run.id)).rejects.toThrow(/cannot continue without its worktree/);
  expect(blockedSpawn.calls).toBe(0);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");

  await restarted.supervisor.resume(run.id);
  await restarted.supervisor.settle();
  expect(restarted.spawn.calls).toBe(1);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("fails a reserved promotion instead of selecting it when the repository is unavailable", async () => {
  const first = makeCompeteSupervisor();
  const run = await first.supervisor.start({ prompt: "the goal", plan: COMPETE_PLAN });
  await first.supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const winner = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Direct");
  if (!group || !winner) throw new Error("expected winner candidate");
  claimCompeteWinner(fix.db, group.id, winner.id);
  const { supervisor: restarted } = makeSupervisor(fix, "complete", {
    repositories: UNAVAILABLE_REPOSITORIES,
  });

  const report = restarted.reconcile();

  expect(report.reconciled).toHaveLength(0);
  expect(listCompeteGroupsForRun(fix.db, run.id)[0]).toMatchObject({
    status: "failed",
    winner_step_run_id: winner.id,
  });
  expect(getRun(fix.db, run.id)?.status).toBe("failed");
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

it("routes messages queued during selection once the winner is chosen", async () => {
  const { supervisor, spawn } = makeCompeteSupervisor();
  const groupOnlyPlan = { ...COMPETE_PLAN, steps: [COMPETE_PLAN.steps[0]!] };
  const run = await supervisor.start({ prompt: "the goal", plan: groupOnlyPlan });
  await supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const candidates = listStepRunsForRun(fix.db, run.id).filter(
    (step) => step.compete_group_id === group?.id,
  );
  const winner = candidates.find((step) => step.name === "Direct");
  const loser = candidates.find((step) => step.name === "Layered");
  if (!group || !winner || !loser) throw new Error("expected both candidates");

  const forWinner = await supervisor.contribute(run.id, winner.id, "polish the direct approach");
  const forLoser = await supervisor.contribute(run.id, loser.id, "polish the layered approach");
  expect(forWinner.status).toBe("queued");
  expect(forLoser.status).toBe("queued");

  await supervisor.selectWinner(run.id, group.id, winner.id);
  await supervisor.settle();

  const contributions = listRunContributions(fix.db, run.id);
  expect(contributions.find((row) => row.id === forWinner.id)?.status).toBe("acknowledged");
  expect(contributions.find((row) => row.id === forLoser.id)?.status).toBe("failed");
  expect(spawn.jobs.at(-1)).toMatchObject({
    mode: "resume",
    stepRunId: winner.id,
    prompt: "polish the direct approach",
  });
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("keeps delivery turns on the selected provider session and canonical worktree", async () => {
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

  await supervisor.contribute(run.id, winner.id, "refine the winner");
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

it("fails a message on a selected winner whose canonical worktree is unavailable", async () => {
  const first = makeCompeteSupervisor();
  const groupOnlyPlan = { ...COMPETE_PLAN, steps: [COMPETE_PLAN.steps[0]!] };
  const run = await first.supervisor.start({ prompt: "the goal", plan: groupOnlyPlan });
  await first.supervisor.settle();
  const [group] = listCompeteGroupsForRun(fix.db, run.id);
  const winner = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Direct");
  if (!group || !winner) throw new Error("expected winner candidate");
  await first.supervisor.selectWinner(run.id, group.id, winner.id);

  const { supervisor: blocked, spawn: blockedSpawn } = makeSupervisor(fix, "complete", {
    repositories: UNAVAILABLE_REPOSITORIES,
  });

  const refused = await blocked.contribute(run.id, winner.id, "continue winner");
  expect(refused.status).toBe("failed");
  expect(refused.delivered_at).toBeNull();
  expect(blockedSpawn.calls).toBe(0);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

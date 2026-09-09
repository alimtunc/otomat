import { join } from "node:path";

import {
  getRun,
  listAgentSessionsForRun,
  schema,
  setStepNextTurnConfig,
  upsertAgent,
} from "@otomat/db";
import { executableSteps, resolvedAgentConfigSchema } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createRepositoryResolver } from "#git";
import { resumeRun } from "#supervisor/commands";
import { resolveResumeAction } from "#supervisor/resume-plan";
import { createState } from "#supervisor/state";
import { scheduleTurn } from "#supervisor/turn-scheduling";

import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { seedWorkflowRun } from "../support/seed.js";

vi.mock("#supervisor/turn-scheduling", async (original) => ({
  ...(await original<typeof import("#supervisor/turn-scheduling")>()),
  scheduleTurn: vi.fn(async () => undefined),
}));
vi.mock("#supervisor/runtime-preflight", async (original) => ({
  ...(await original<typeof import("#supervisor/runtime-preflight")>()),
  preflightResumeAction: vi.fn(),
}));

let fixture: TestDb;
beforeEach(() => {
  fixture = setupTestDb("otomat-recovery-config-");
  seedRepository(fixture.db);
  upsertAgent(fixture.db, { id: "codex", name: "Codex CLI", runtime: "codex" });
});
afterEach(() => {
  fixture.cleanup();
  vi.clearAllMocks();
});

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "preserves frozen permissions in recovery or simulated competitor scheduling (competitor=%s, pending=%s)",
  async (competitor, pending) => {
    seedWorkflowRun(fixture.db, {
      runId: "recover",
      runStatus: competitor ? "awaiting_human" : "failed",
      steps: [
        {
          id: "step",
          agent: "codex",
          status: competitor ? "awaiting_human" : "stale",
          session: {
            status: competitor ? "awaiting_input" : "failed",
            providerSessionId: competitor ? "thread" : null,
          },
        },
        ...(competitor ? [{ id: "other", agent: "codex", status: "succeeded" as const }] : []),
      ],
    });
    const config = resolvedAgentConfigSchema.parse({
      runtime: "codex",
      profile_id: null,
      profile_name: null,
      guidance: null,
      skills: [],
      model: null,
      options: {
        sandbox: "read-only",
        approval_policy: "on-request",
        approvals_reviewer: "auto_review",
      },
      sources: {
        runtime: "launch",
        model: "provider",
        options: { sandbox: "turn", approval_policy: "profile", approvals_reviewer: "profile" },
      },
      config_hash: "latest",
    });
    fixture.db
      .update(schema.agentSessions)
      .set({ config_json: config })
      .where(eq(schema.agentSessions.id, "step-session"))
      .run();
    const next = {
      ...config,
      config_hash: "pending",
      options: { ...config.options, sandbox: "workspace-write" },
    };
    if (pending) setStepNextTurnConfig(fixture.db, "step", next);
    if (competitor) {
      const seeded = getRun(fixture.db, "recover");
      if (!seeded) throw new Error("No seeded run");
      fixture.db
        .update(schema.runs)
        .set({
          plan_json: {
            version: 1,
            steps: [
              {
                id: "group",
                name: "Candidates",
                depends_on: [],
                compete: executableSteps(seeded.plan_json),
              },
            ],
          },
        })
        .where(eq(schema.runs.id, seeded.id))
        .run();
      fixture.db
        .insert(schema.competeGroups)
        .values({
          id: "group",
          run_id: seeded.id,
          idx: 0,
          name: "Candidates",
          status: "awaiting_human",
        })
        .run();
      fixture.db
        .update(schema.stepRuns)
        .set({ compete_group_id: "group" })
        .where(eq(schema.stepRuns.run_id, seeded.id))
        .run();
      fixture.db
        .insert(schema.worktrees)
        .values({
          id: "candidate-worktree",
          repository_id: "repo-1",
          path: join(fixture.dir, "candidate"),
          branch: "candidate",
          head_sha: "",
          base_sha: "",
          base_ref: "main",
          owner_token: "step",
          status: "active",
        })
        .run();
    }
    const state = createState({
      db: fixture.db,
      dataDir: fixture.dir,
      defaultProjectId: "p1",
      spawn: vi.fn(),
      repositories: createRepositoryResolver({
        db: fixture.db,
        worktreesRoot: join(fixture.dir, "worktrees"),
      }),
    });
    const run = getRun(fixture.db, "recover");
    if (!run) throw new Error("No seeded run");
    const before = structuredClone(run.plan_json);
    const expectedConfig = pending ? next : config;
    if (competitor) {
      expect(resolveResumeAction(state, run)).toMatchObject({
        kind: "compete_group",
        competitors: [{ config: expectedConfig }],
      });
      await resumeRun(state, run.id);
      expect(scheduleTurn).toHaveBeenCalledWith(
        state,
        expect.objectContaining({ config: expectedConfig }),
        "resume",
        "thread",
      );
      const sessions = listAgentSessionsForRun(fixture.db, run.id);
      expect(sessions).toHaveLength(pending ? 2 : 1);
      expect(sessions.at(-1)?.config_json).toEqual(expectedConfig);
      if (pending) expect(sessions.at(-1)?.resumed_from_session_id).toBe("step-session");
    } else {
      expect(resolveResumeAction(state, run)).toMatchObject({
        kind: "recovery",
        step: { config: expectedConfig },
      });
    }
    expect(getRun(fixture.db, "recover")?.plan_json).toEqual(before);
    expect(state.spawn).not.toHaveBeenCalled();
  },
);

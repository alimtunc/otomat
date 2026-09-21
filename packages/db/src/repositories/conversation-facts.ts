import {
  planStepFor,
  runPlanSchema,
  type ConversationEvidence,
  type ConversationMessageEvidence,
  type RunPlan,
} from "@otomat/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import {
  agentSessions,
  runContributions,
  runInteractions,
  runtimeEvents,
} from "../schema/index.js";
import { sqliteToIso } from "./instants.js";

export type ConversationThreads = Map<string, ConversationEvidence>;

export interface ConversationThreadStep {
  step_run_id: string;
  run_id: string;
  plan_json: unknown;
}

const NOT_THINKING = sql`coalesce(json_extract(${runtimeEvents.payload}, '$.thinking'), 0) = 0`;

/** The newest answer per step, resolved in two bounded reads because `seq` is only unique within a run. */
export function latestAgentMessages(
  db: Db,
  runIds: string[],
): Map<string, ConversationMessageEvidence> {
  const scope = and(
    inArray(runtimeEvents.run_id, runIds),
    eq(runtimeEvents.type, "runtime.message"),
    NOT_THINKING,
  );
  const newest = db
    .select({ step_run_id: runtimeEvents.step_run_id, seq: sql<number>`max(${runtimeEvents.seq})` })
    .from(runtimeEvents)
    .where(scope)
    .groupBy(runtimeEvents.step_run_id)
    .all();
  if (newest.length === 0) return new Map();
  const wanted = new Set(newest.map((row) => `${row.step_run_id}:${row.seq}`));
  const messages = new Map<string, ConversationMessageEvidence>();
  for (const row of db
    .select({
      step_run_id: runtimeEvents.step_run_id,
      seq: runtimeEvents.seq,
      occurred_at: runtimeEvents.occurred_at,
      text: sql<string | null>`json_extract(${runtimeEvents.payload}, '$.text')`,
    })
    .from(runtimeEvents)
    .where(
      and(
        scope,
        inArray(
          runtimeEvents.seq,
          newest.map((candidate) => candidate.seq),
        ),
      ),
    )
    .all()) {
    if (row.step_run_id === null || !wanted.has(`${row.step_run_id}:${row.seq}`)) continue;
    messages.set(row.step_run_id, { text: row.text ?? "", at: row.occurred_at });
  }
  return messages;
}

export function attachContributions(db: Db, runIds: string[], threads: ConversationThreads): void {
  for (const row of db
    .select({
      step_run_id: runContributions.step_run_id,
      status: runContributions.status,
      body: runContributions.body,
      created_at: runContributions.created_at,
      updated_at: runContributions.updated_at,
    })
    .from(runContributions)
    .where(inArray(runContributions.run_id, runIds))
    .orderBy(desc(runContributions.seq))
    .all()) {
    const thread = threads.get(row.step_run_id);
    if (thread === undefined) continue;
    if (thread.last_user_message === null) {
      thread.last_user_message = { text: row.body, at: sqliteToIso(row.created_at) };
    }
    if (row.status === "queued") thread.queued_contributions += 1;
    if (row.status === "failed" && thread.failed_contribution_at === null) {
      thread.failed_contribution_at = sqliteToIso(row.updated_at);
    }
  }
}

export function attachInteractions(db: Db, runIds: string[], threads: ConversationThreads): void {
  for (const row of db
    .select({
      step_run_id: runInteractions.step_run_id,
      kind: runInteractions.kind,
      prompt: runInteractions.prompt,
      requested_at: runInteractions.requested_at,
    })
    .from(runInteractions)
    .where(and(inArray(runInteractions.run_id, runIds), eq(runInteractions.state, "pending")))
    .orderBy(asc(runInteractions.requested_at))
    .all()) {
    const thread = threads.get(row.step_run_id);
    if (thread !== undefined && thread.pending_interaction === null) {
      thread.pending_interaction = {
        kind: row.kind,
        prompt: row.prompt,
        requested_at: row.requested_at,
      };
    }
  }
}

/** The latest turn's frozen configuration; a step that has not started yet reads the plan node it was launched with. */
export function attachParticipants(
  db: Db,
  steps: ConversationThreadStep[],
  threads: ConversationThreads,
): void {
  for (const row of db
    .select({
      step_run_id: agentSessions.step_run_id,
      config: agentSessions.config_json,
      reported_model: agentSessions.reported_model,
    })
    .from(agentSessions)
    .where(
      inArray(
        agentSessions.step_run_id,
        steps.map((step) => step.step_run_id),
      ),
    )
    .orderBy(desc(agentSessions.turn_index))
    .all()) {
    const thread = threads.get(row.step_run_id);
    if (thread === undefined || thread.config !== null) continue;
    thread.config = row.config;
    thread.reported_model = row.reported_model;
  }
  const plans = new Map<string, RunPlan>();
  for (const step of steps) {
    const thread = threads.get(step.step_run_id);
    if (thread === undefined || thread.config !== null) continue;
    let plan = plans.get(step.run_id);
    if (plan === undefined) {
      plan = runPlanSchema.parse(step.plan_json);
      plans.set(step.run_id, plan);
    }
    thread.config = planStepFor(plan, step.step_run_id)?.config ?? null;
  }
}

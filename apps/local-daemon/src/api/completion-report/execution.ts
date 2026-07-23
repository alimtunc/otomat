import {
  getAgent,
  type Db,
  type listAgentSessionsForRun,
  type listStepRunsForRun,
} from "@otomat/db";
import {
  isRunTerminal,
  reportStepSchema,
  type CompletionEvidence,
  type EventEnvelope,
  type RunCompletionReport,
  type RunState,
} from "@otomat/domain";

import { comparePersistedRows } from "./persisted-order.js";

interface ExecutionProjectionInput {
  db: Db;
  events: readonly EventEnvelope[];
  notices: RunCompletionReport["notices"];
  run: { id: string; issue_id: string; branch: string; status: RunState };
  sessions: ReturnType<typeof listAgentSessionsForRun>;
  steps: ReturnType<typeof listStepRunsForRun>;
}

function timeline(seq: number | null): CompletionEvidence[] {
  return [{ source: "timeline", seq }];
}

function latestEvent(
  events: readonly EventEnvelope[],
  predicate: (event: EventEnvelope) => boolean,
): EventEnvelope | undefined {
  return events.findLast(predicate);
}

function projectRun(
  run: ExecutionProjectionInput["run"],
  events: readonly EventEnvelope[],
): RunCompletionReport["run"] {
  const reconciliation = latestEvent(events, (event) => event.type === "system.reconciled");
  const lifecycle = latestEvent(
    events,
    (event) => event.type === "run.lifecycle" || event.type === "system.reconciled",
  );
  let outcome: RunCompletionReport["run"]["outcome"] = "in_progress";
  if (run.status === "completed") outcome = "succeeded";
  else if (run.status === "failed") outcome = "failed";
  else if (run.status === "canceled") outcome = "canceled";
  else if (reconciliation?.payload["classification"] === "interrupted") outcome = "interrupted";
  return {
    id: run.id,
    issue_id: run.issue_id,
    branch: run.branch,
    status: run.status,
    outcome,
    terminal: isRunTerminal(run.status),
    evidence: timeline(lifecycle?.seq ?? null),
  };
}

function projectSteps({
  db,
  events,
  notices,
  sessions,
  steps,
}: ExecutionProjectionInput): RunCompletionReport["steps"] {
  return steps.flatMap((step) => {
    const stepSessions = sessions
      .filter((session) => session.step_run_id === step.id)
      .toSorted(comparePersistedRows);
    const agent = stepSessions
      .flatMap((session) => (session.agent_id ? [getAgent(db, session.agent_id)] : []))
      .find(Boolean);
    const stepEvent = latestEvent(events, (event) => event.step_run_id === step.id);
    const parsed = reportStepSchema.safeParse({
      id: step.id,
      name: step.name,
      status: step.status,
      runtime: agent?.runtime ?? null,
      provider_sessions: stepSessions.flatMap((session) =>
        session.provider_session_id ? [session.provider_session_id] : [],
      ),
      evidence: timeline(stepEvent?.seq ?? null),
    });
    if (parsed.success) return [parsed.data];
    notices.push({
      code: "step_corrupt",
      message: `Persisted step ${step.id} could not be read.`,
      evidence: timeline(stepEvent?.seq ?? null),
    });
    return [];
  });
}

export function projectExecution(
  input: ExecutionProjectionInput,
): Pick<RunCompletionReport, "run" | "steps"> {
  return {
    run: projectRun(input.run, input.events),
    steps: projectSteps(input),
  };
}

import { join } from "node:path";

import { z } from "zod";

import { EVENTS_FILENAME } from "#events";
import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  JsonlEventSink,
  type KnownRuntimeId,
  type RuntimeFinalState,
} from "#runtime";

import { buildTerminalMarker } from "./markers.js";
import { waitForWorkerStart, WORKER_START_TOKEN_ENV } from "./start-gate.js";
import { WORKER_JOB_ENV, type SupervisedJob } from "./types.js";

const supervisedJobSchema = z.object({
  runId: z.string(),
  stepRunId: z.string(),
  agentSessionId: z.string(),
  prompt: z.string(),
  runDir: z.string(),
  worktreePath: z.string().nullable(),
  runtime: z.custom<KnownRuntimeId>(
    (value) => typeof value === "string" && isKnownRuntimeId(value),
    "unknown runtime",
  ),
  mode: z.enum(["run", "resume"]),
  providerSessionId: z.string().nullable(),
}) satisfies z.ZodType<SupervisedJob>;

/** Parses the serialized job from `WORKER_JOB_ENV`; null when the var is absent or empty. Throws (zod/JSON) when it is present but malformed. */
export function parseJob(env: NodeJS.ProcessEnv): SupervisedJob | null {
  const raw = env[WORKER_JOB_ENV];
  if (raw === undefined || raw === "") return null;
  return supervisedJobSchema.parse(JSON.parse(raw));
}

/**
 * Runs one turn through the runtime adapter — or resumes the provider session when
 * `job.mode` is `resume` — streaming every event into the job's `events.jsonl` and
 * closing the sink before returning. Rejects if the turn throws.
 */
export async function runWorkerJob(
  job: SupervisedJob,
  signal: AbortSignal,
): Promise<RuntimeFinalState> {
  const adapter = createRuntimeAdapter(job.runtime);
  // The worker owns durability: every event lands in the run's events.jsonl for the tailer/reconciliation.
  const sink = new JsonlEventSink(join(job.runDir, EVENTS_FILENAME));
  try {
    if (job.mode === "resume") {
      if (!adapter.resume) {
        return {
          status: "failed",
          provider_session_id: job.providerSessionId,
          usage: null,
          error: { message: `runtime ${job.runtime} does not support resume` },
          event_count: 0,
        };
      }
      return await adapter.resume(
        {
          run_id: job.runId,
          step_run_id: job.stepRunId,
          agent_session_id: job.agentSessionId,
          provider_session_id: job.providerSessionId,
        },
        { prompt: job.prompt, run_dir: job.runDir, cwd: job.worktreePath },
        sink,
        signal,
      );
    }
    return await adapter.run(
      {
        run_id: job.runId,
        step_run_id: job.stepRunId,
        agent_session_id: job.agentSessionId,
        prompt: job.prompt,
        run_dir: job.runDir,
        cwd: job.worktreePath,
      },
      sink,
      signal,
    );
  } finally {
    sink.close();
  }
}

/** Appends the run's terminal-marker line (final status, provider session, event count) to its `events.jsonl` — the durable sentinel reconciliation reads to tell a finished run from a torn one. */
export function writeTerminalMarker(
  job: SupervisedJob,
  final: RuntimeFinalState,
  occurredAt: string,
): void {
  const marker = buildTerminalMarker(
    { runId: job.runId, stepRunId: job.stepRunId, agentSessionId: job.agentSessionId },
    final.status,
    final.provider_session_id,
    final.event_count,
    occurredAt,
  );
  const sink = new JsonlEventSink(join(job.runDir, EVENTS_FILENAME));
  try {
    sink.emit(marker);
  } finally {
    sink.close();
  }
}

// SIGTERM/SIGINT abort the turn so the adapter writes a `canceled` marker; SIGKILL leaves
// none, which reconciliation reads as interrupted (resumable).
export async function runWorkerMain(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const job = parseJob(env);
  if (job === null) {
    console.error("[otomat] worker: no job in environment");
    process.exit(2);
  }

  const controller = new AbortController();
  const onSignal = (): void => controller.abort();
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  try {
    const startToken = env[WORKER_START_TOKEN_ENV];
    if (!startToken) throw new Error("worker start token is missing");
    if (!(await waitForWorkerStart(job.runDir, startToken, controller.signal))) {
      throw new Error("worker was not released before startup timed out");
    }
    const final = await runWorkerJob(job, controller.signal);
    writeTerminalMarker(job, final, new Date().toISOString());
    process.exit(final.status === "failed" ? 1 : 0);
  } catch (error) {
    console.error("[otomat] worker job failed", error);
    process.exit(1);
  }
}

import { join } from "node:path";

import { FakeRuntimeAdapter, JsonlEventSink, MemorySink, type RuntimeFinalState } from "#runtime";

import { buildTerminalMarker } from "./marker.js";
import { WORKER_JOB_ENV, type SupervisedJob } from "./types.js";

/** Reads the job a parent supervisor handed this process, or null when run outside worker mode. */
export function parseJob(env: NodeJS.ProcessEnv): SupervisedJob | null {
  const raw = env[WORKER_JOB_ENV];
  if (raw === undefined || raw === "") return null;
  return JSON.parse(raw) as SupervisedJob;
}

/** Executes one turn with the fake adapter, which streams its evidence into the run's `events.jsonl`. */
export function runWorkerJob(job: SupervisedJob, signal: AbortSignal): Promise<RuntimeFinalState> {
  const adapter = new FakeRuntimeAdapter();
  const sink = new MemorySink();
  if (job.mode === "resume") {
    return adapter.resume(
      {
        run_id: job.runId,
        step_run_id: job.stepRunId,
        agent_session_id: job.agentSessionId,
        provider_session_id: job.providerSessionId,
      },
      { prompt: job.prompt, run_dir: job.runDir },
      sink,
      signal,
    );
  }
  return adapter.run(
    {
      run_id: job.runId,
      step_run_id: job.stepRunId,
      agent_session_id: job.agentSessionId,
      prompt: job.prompt,
      run_dir: job.runDir,
    },
    sink,
    signal,
  );
}

/** Appends the durable terminal marker as the final `events.jsonl` line, so reconciliation can read the outcome. */
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
  const sink = new JsonlEventSink(join(job.runDir, "events.jsonl"));
  try {
    sink.emit(marker);
  } finally {
    sink.close();
  }
}

/**
 * Worker entrypoint: run the job, write the terminal marker, exit. A `SIGTERM`/`SIGINT`
 * (graceful abort) aborts the turn so the adapter writes a `canceled` marker; a `SIGKILL`
 * leaves no marker, which reconciliation reads as an interrupted (resumable) run.
 */
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
    const final = await runWorkerJob(job, controller.signal);
    writeTerminalMarker(job, final, new Date().toISOString());
    process.exit(final.status === "failed" ? 1 : 0);
  } catch (error) {
    console.error("[otomat] worker job failed", error);
    process.exit(1);
  }
}

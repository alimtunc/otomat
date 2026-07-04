// Pure Node with no workspace imports so the spawned child survives independent of the test process; behavior via FAKE_WORKER_BEHAVIOR.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const job = JSON.parse(process.env.OTOMAT_WORKER_JOB);
const behavior = process.env.FAKE_WORKER_BEHAVIOR ?? "complete";
const file = join(job.runDir, "events.jsonl");
mkdirSync(dirname(file), { recursive: true });

const provider = `fake-session-${job.runId}`;
let n = 0;

function emit(type, source, payload) {
  const event = {
    id: `${job.runId}:${n++}`,
    run_id: job.runId,
    step_run_id: job.stepRunId,
    agent_session_id: job.agentSessionId,
    type,
    source,
    occurred_at: new Date().toISOString(),
    payload,
    raw_ref: null,
  };
  appendFileSync(file, `${JSON.stringify(event)}\n`);
}

function marker(status) {
  emit("run.lifecycle", "otomat", {
    fidelity: "parsed",
    adapter: "otomat-supervisor",
    phase: "final",
    final_status: status,
    provider_session_id: provider,
    event_count: n,
  });
}

emit("runtime.provider_session", "otomat", {
  fidelity: "native",
  adapter: "fake",
  test_adapter: true,
  provider_session_id: provider,
});
emit("runtime.log", "otomat", {
  fidelity: "raw_log",
  adapter: "fake",
  test_adapter: true,
  text: "working",
});

if (behavior === "complete") {
  marker("completed");
  process.exit(0);
} else if (behavior === "crash") {
  process.exit(1);
} else {
  process.on("SIGTERM", () => {
    marker("canceled");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}

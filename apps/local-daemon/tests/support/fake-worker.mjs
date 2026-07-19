// Pure Node with no workspace imports so the spawned child survives independent of the test process; behavior via FAKE_WORKER_BEHAVIOR.
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const job = JSON.parse(process.env.OTOMAT_WORKER_JOB);
const behavior = process.env.FAKE_WORKER_BEHAVIOR ?? "complete";
const startToken = process.env.OTOMAT_WORKER_START_TOKEN;
const file = join(job.runDir, "events.jsonl");
mkdirSync(dirname(file), { recursive: true });

if (!startToken) throw new Error("missing fake worker start token");
const startGate = join(job.runDir, `.worker-start-${startToken}`);
const deadline = Date.now() + 30_000;
while (!existsSync(startGate) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}
if (!existsSync(startGate)) process.exit(1);
unlinkSync(startGate);

const provider = `fake-session-${job.runId}`;
let n = 0;

function emit(type, source, payload) {
  const event = {
    // pid-scoped so ids stay unique across the several worker turns of one run.
    id: `${job.agentSessionId}:${process.pid}:${n++}`,
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
} else if (behavior === "fail") {
  marker("failed");
  process.exit(1);
} else if (behavior === "crash") {
  process.exit(1);
} else {
  process.on("SIGTERM", () => {
    marker("canceled");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}

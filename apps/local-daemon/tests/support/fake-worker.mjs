// Pure Node with no workspace imports so the spawned child survives independent of the test process; behavior via FAKE_WORKER_BEHAVIOR.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

const job = JSON.parse(process.env.OTOMAT_WORKER_JOB);
const behavior = process.env.FAKE_WORKER_BEHAVIOR ?? "complete";
const startToken = process.env.OTOMAT_WORKER_START_TOKEN;
const file = join(job.agentSessionDir, "events.jsonl");
mkdirSync(dirname(file), { recursive: true });

if (!startToken) throw new Error("missing fake worker start token");
const startGate = join(job.agentSessionDir, `.worker-start-${startToken}`);
const deadline = Date.now() + 30_000;
while (!existsSync(startGate) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}
if (!existsSync(startGate)) process.exit(1);
// Mirrors the real gate: taking it renames rather than deletes, so boot can prove this worker ran.
renameSync(startGate, join(job.agentSessionDir, `.worker-started-${startToken}`));

const provider = `fake-session-${job.agentSessionId}`;
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

function marker(status, providerLimit = null) {
  emit("run.lifecycle", "otomat", {
    fidelity: "parsed",
    adapter: "otomat-supervisor",
    phase: "final",
    final_status: status,
    provider_session_id: provider,
    provider_limit: providerLimit,
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
} else if (behavior === "slow") {
  // Long enough for the parent to observe a live turn before this one settles.
  await new Promise((resolve) => setTimeout(resolve, 400));
  marker("completed");
  process.exit(0);
} else if (behavior === "fail") {
  marker("failed");
  process.exit(1);
} else if (behavior === "quota" || behavior === "quota-undated") {
  // A dated reset is one hour out, so the wait it schedules is genuinely in the future.
  const limit = {
    provider: "fake",
    reason: "fake usage limit reached",
    resume_at: behavior === "quota" ? new Date(Date.now() + 3_600_000).toISOString() : null,
  };
  emit("runtime.provider_limit", "otomat", {
    fidelity: "native",
    adapter: "fake",
    test_adapter: true,
    ...limit,
  });
  marker("failed", limit);
  process.exit(1);
} else if (behavior === "live" || behavior === "live-refuse") {
  // Mirrors the worker's real live-input protocol: tail the daemon's inbox, receipt each write, linger like `linger`.
  const error = behavior === "live-refuse" ? "stdin closed" : null;
  const inbox = join(job.agentSessionDir, "live-input.jsonl");
  const receipts = join(job.agentSessionDir, "live-input-receipts.jsonl");
  let taken = 0;
  setInterval(() => {
    if (!existsSync(inbox)) return;
    const lines = readFileSync(inbox, "utf8").split("\n").filter(Boolean);
    for (const line of lines.slice(taken)) {
      const message = JSON.parse(line);
      if (error === null) {
        emit("runtime.message", "otomat", {
          fidelity: "parsed",
          adapter: "fake",
          test_adapter: true,
          role: "user",
          text: message.body,
        });
      }
      appendFileSync(receipts, `${JSON.stringify({ id: message.id, error })}\n`);
    }
    taken = lines.length;
  }, 10);
  process.on("SIGTERM", () => {
    marker("canceled");
    process.exit(0);
  });
} else if (behavior === "crash") {
  process.exit(1);
} else {
  process.on("SIGTERM", () => {
    marker("canceled");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}

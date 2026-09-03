#!/usr/bin/env node
// Provider-CLI stand-in for adapter tests: replays OTOMAT_STUB_FIXTURE to stdout, then exits/hangs per OTOMAT_STUB_* env; injected via the adapters' binary constructor parameter.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

if (process.env.OTOMAT_STUB_PID_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_PID_FILE, String(process.pid));
}

if (process.env.OTOMAT_STUB_ARGS_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_ARGS_FILE, JSON.stringify(process.argv.slice(2)));
}

if (process.env.OTOMAT_STUB_ENV_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_ENV_FILE, JSON.stringify(process.env));
}

function valueForArgv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const map = JSON.parse(raw);
  return map[process.argv.slice(2).join(" ")] ?? fallback;
}

function replay(fixture) {
  if (!fixture) return;
  const lines = readFileSync(fixture, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
  for (const line of lines) process.stdout.write(`${line}\n`);
}

const stdinFile = process.env.OTOMAT_STUB_STDIN_FILE;

// Permission stand-in: replay the prelude, ask once over the control channel, and report the decision the client sent back.
if (process.env.OTOMAT_STUB_PERMISSION === "1") {
  replay(process.env.OTOMAT_STUB_FIXTURE);
  process.stdout.write(
    `${JSON.stringify({
      type: "control_request",
      request_id: "req-perm-1",
      request: {
        subtype: "can_use_tool",
        tool_name: "Write",
        display_name: "Write",
        description: "notes.md",
        input: { file_path: "notes.md", content: "ok" },
        decision_reason: "the deny rule Read(./notes.md) covers it; only you can approve it.",
        tool_use_id: "tu-perm-1",
      },
    })}\n`,
  );
  for await (const line of createInterface({ input: process.stdin })) {
    if (stdinFile) appendFileSync(stdinFile, `${line}\n`);
    const frame = JSON.parse(line);
    if (frame.type !== "control_response") continue;
    process.stdout.write(
      `${JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: frame.response.response.behavior,
        session_id: "sess-claude-1",
        total_cost_usd: 0.001,
        usage: { input_tokens: 10, output_tokens: 1 },
        permission_denials:
          frame.response.response.behavior === "deny"
            ? [{ tool_name: "Write", tool_use_id: "tu-perm-1", tool_input: {} }]
            : [],
      })}\n`,
    );
    process.exit(0);
  }
  process.exit(0);
}

// Streaming-input stand-in: replay the prelude, then answer one result frame per user message and exit at EOF.
if (process.env.OTOMAT_STUB_STREAM_INPUT === "1") {
  replay(valueForArgv("OTOMAT_STUB_FIXTURES", process.env.OTOMAT_STUB_FIXTURE));
  let results = 0;
  for await (const line of createInterface({ input: process.stdin })) {
    if (stdinFile) appendFileSync(stdinFile, `${line}\n`);
    results += 1;
    process.stdout.write(
      `${JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "ok",
        session_id: "sess-claude-1",
        // Like the real CLI: per-loop usage, running cost total for the invocation.
        total_cost_usd: 0.001 * results,
        usage: { input_tokens: 10, output_tokens: 1 },
      })}\n`,
    );
  }
  process.exit(0);
}

// Drain stdin (the adapter pipes the prompt) so the parent never blocks on a full pipe.
if (stdinFile) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  writeFileSync(stdinFile, Buffer.concat(chunks));
} else {
  process.stdin.resume();
}

const stderr = valueForArgv("OTOMAT_STUB_STDERRS", process.env.OTOMAT_STUB_STDERR);
if (stderr) process.stderr.write(`${stderr}\n`);

replay(valueForArgv("OTOMAT_STUB_FIXTURES", process.env.OTOMAT_STUB_FIXTURE));

if (process.env.OTOMAT_STUB_HANG === "1") {
  setInterval(() => {}, 60_000);
} else {
  process.exit(Number(valueForArgv("OTOMAT_STUB_EXITS", process.env.OTOMAT_STUB_EXIT ?? 0)));
}

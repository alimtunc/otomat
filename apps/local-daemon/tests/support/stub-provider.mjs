#!/usr/bin/env node
// Provider-CLI stand-in for adapter tests: replays OTOMAT_STUB_FIXTURE to stdout, then exits/hangs per OTOMAT_STUB_* env; injected via the adapters' binary constructor parameter.
import { readFileSync, writeFileSync } from "node:fs";

if (process.env.OTOMAT_STUB_PID_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_PID_FILE, String(process.pid));
}

if (process.env.OTOMAT_STUB_ARGS_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_ARGS_FILE, JSON.stringify(process.argv.slice(2)));
}

if (process.env.OTOMAT_STUB_ENV_FILE) {
  writeFileSync(process.env.OTOMAT_STUB_ENV_FILE, JSON.stringify(process.env));
}

// Drain stdin (the adapter pipes the prompt) so the parent never blocks on a full pipe.
process.stdin.resume();

if (process.env.OTOMAT_STUB_STDERR) {
  process.stderr.write(`${process.env.OTOMAT_STUB_STDERR}\n`);
}

const fixture = process.env.OTOMAT_STUB_FIXTURE;
if (fixture) {
  const lines = readFileSync(fixture, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
  for (const line of lines) process.stdout.write(`${line}\n`);
}

if (process.env.OTOMAT_STUB_HANG === "1") {
  setInterval(() => {}, 60_000);
} else {
  process.exit(Number(process.env.OTOMAT_STUB_EXIT ?? 0));
}

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  criticalPathSeconds,
  formatDuration,
  jobPhases,
  percentile,
  renderSummary,
} from "./timings.mjs";

const STARTED = "2026-09-03T21:24:44Z";

function job(name, startOffset, endOffset, steps = []) {
  const at = (offset) => new Date(Date.parse(STARTED) + offset * 1000).toISOString();
  return {
    name,
    conclusion: "success",
    started_at: at(startOffset),
    completed_at: at(endOffset),
    steps: steps.map(([stepName, from, to]) => ({
      name: stepName,
      started_at: at(from),
      completed_at: at(to),
    })),
  };
}

test("formats durations below and above a minute", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(-5), "0s");
  assert.equal(formatDuration(59), "59s");
  assert.equal(formatDuration(60), "1m00s");
  assert.equal(formatDuration(243), "4m03s");
});

test("takes percentiles by nearest rank", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(values, 0.5), 50);
  assert.equal(percentile(values, 0.95), 100);
  assert.equal(percentile([7], 0.95), 7);
});

test("measures the critical path from the attempt start to the aggregator", () => {
  const jobs = [
    job("static", 3, 42),
    job("test-web (1)", 3, 236),
    job("check", 237, 245),
    { name: "package-macos", conclusion: null, started_at: null, completed_at: null },
    job("timings", 250, 260),
  ];
  assert.equal(criticalPathSeconds(STARTED, jobs, "check"), 245);
});

test("has no critical path while the aggregator is unfinished", () => {
  const running = { name: "check", conclusion: null, started_at: null, completed_at: null };
  assert.equal(criticalPathSeconds(STARTED, [job("static", 3, 42), running], "check"), null);
  assert.equal(criticalPathSeconds(STARTED, [job("static", 3, 42)], "check"), null);
});

test("refuses a span for a failed gate, and ignores an earlier attempt's jobs", () => {
  const failed = { ...job("check", 140, 145), conclusion: "failure" };
  assert.equal(criticalPathSeconds(STARTED, [job("static", 3, 42), failed], "check"), null);

  const rerun = [job("static", -600, -400), job("check", 10, 20)];
  assert.equal(criticalPathSeconds(STARTED, rerun, "check"), 20);
  assert.doesNotMatch(
    renderSummary({ startedAt: STARTED, event: "push", jobs: rerun, baseline: [], gate: "check" }),
    /\| static \|/,
  );
});

test("keeps only phases that took at least a second", () => {
  const phases = jobPhases(job("build", 0, 60, [["Set up job", 0, 0], ["Install", 1, 21]]));
  assert.deepEqual(phases, [{ name: "Install", seconds: 20 }]);
});

test("renders the gates, the critical path and the baseline", () => {
  const summary = renderSummary({
    startedAt: STARTED,
    event: "pull_request",
    jobs: [
      job("test-web (1)", 3, 138, [["Test web", 20, 138]]),
      job("check", 140, 145),
      { name: "timings", conclusion: null, started_at: null, completed_at: null },
    ],
    baseline: [243, 260, 638],
    gate: "check",
  });

  assert.match(summary, /\| test-web \(1\) \| \+3s \| 2m15s \| \+2m18s \|/);
  assert.match(summary, /Critical path, event to `check`: \*\*2m25s\*\*/);
  assert.match(summary, /p50 \*\*4m20s\*\*, p95 \*\*10m38s\*\*/);
  assert.match(summary, /\| test-web \(1\) \| Test web \| 1m58s \|/);
  assert.doesNotMatch(summary, /\| timings \|/);
});

test("never invents a critical path or a baseline it does not have", () => {
  const summary = renderSummary({
    startedAt: STARTED,
    event: "push",
    jobs: [job("static", 3, 42)],
    baseline: [],
    gate: "check",
  });

  assert.match(summary, /Critical path: none — `check` did not succeed/);
  assert.doesNotMatch(summary, /0s\*\*/);
  assert.doesNotMatch(summary, /Baseline over/);
});

#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { criticalPathSeconds, renderSummary } from "./timings.mjs";

const BASELINE_RUNS = 20;
const GATE = "check";

const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const token = process.env.GITHUB_TOKEN;
const stepSummary = process.env.GITHUB_STEP_SUMMARY;

if (!repository || !runId || !token || !stepSummary) {
  console.error(
    "ci/summary: GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_TOKEN and GITHUB_STEP_SUMMARY are required.",
  );
  process.exit(1);
}

async function api(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${path} answered ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const runJobs = (id) => api(`/repos/${repository}/actions/runs/${id}/jobs?per_page=100`);

// `created_at` survives a re-run, so only `run_started_at` dates the attempt these jobs belong to.
const run = await api(`/repos/${repository}/actions/runs/${runId}`);
const { jobs } = await runJobs(runId);
const history = await api(
  `/repos/${repository}/actions/workflows/${run.workflow_id}/runs` +
    `?event=${run.event}&status=success&exclude_pull_requests=true&per_page=${BASELINE_RUNS}`,
);

// A re-run repeats only part of the graph, so its span is not comparable with a whole run's.
const sampled = await Promise.allSettled(
  history.workflow_runs
    .filter((past) => past.run_attempt === 1)
    .map(async (past) =>
      criticalPathSeconds(past.run_started_at, (await runJobs(past.id)).jobs, GATE),
    ),
);
for (const sample of sampled) {
  if (sample.status === "rejected") {
    console.error(`ci/summary: baseline run dropped — ${sample.reason.message}`);
  }
}

const baseline = sampled
  .filter((sample) => sample.status === "fulfilled" && sample.value !== null)
  .map((sample) => sample.value);

appendFileSync(
  stepSummary,
  renderSummary({
    startedAt: run.run_started_at,
    event: run.event,
    jobs,
    baseline,
    gate: GATE,
  }),
);

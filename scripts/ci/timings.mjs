export function formatDuration(seconds) {
  const total = Math.max(seconds, 0);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s`;
}

export function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank - 1, 0), sorted.length - 1)];
}

// A partial re-run leaves the jobs it did not repeat at the earlier attempt's timestamps.
function attemptJobs(jobs, startedAt) {
  const start = Date.parse(startedAt);
  return jobs.filter(
    (job) =>
      job.conclusion !== "skipped" &&
      typeof job.started_at === "string" &&
      typeof job.completed_at === "string" &&
      Date.parse(job.started_at) >= start,
  );
}

// Only the aggregator runs on every event: the slowest job would measure a pull request against a
// push that also packaged macOS.
export function criticalPathSeconds(startedAt, jobs, gate) {
  const aggregator = attemptJobs(jobs, startedAt).find(
    (job) => job.name === gate && job.conclusion === "success",
  );
  if (!aggregator) return null;
  return Math.round((Date.parse(aggregator.completed_at) - Date.parse(startedAt)) / 1000);
}

export function jobPhases(job) {
  return (job.steps ?? [])
    .filter((step) => typeof step.started_at === "string" && typeof step.completed_at === "string")
    .map((step) => ({
      name: step.name,
      seconds: Math.round((Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000),
    }))
    .filter((phase) => phase.seconds > 0);
}

export function renderSummary({ startedAt, event, jobs, baseline, gate }) {
  const start = Date.parse(startedAt);
  const finished = attemptJobs(jobs, startedAt).sort(
    (a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at),
  );
  const lines = [
    "## CI timings",
    "",
    "| Job | Starts | Runs | Done |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const job of finished) {
    const from = Math.round((Date.parse(job.started_at) - start) / 1000);
    const to = Math.round((Date.parse(job.completed_at) - start) / 1000);
    lines.push(
      `| ${job.name} | +${formatDuration(from)} | ${formatDuration(to - from)} | +${formatDuration(to)} |`,
    );
  }

  const path = criticalPathSeconds(startedAt, jobs, gate);
  lines.push(
    "",
    path === null
      ? `Critical path: none — \`${gate}\` did not succeed in this attempt.`
      : `Critical path, event to \`${gate}\`: **${formatDuration(path)}**`,
  );

  if (baseline.length > 0) {
    lines.push(
      "",
      `Baseline over ${baseline.length} recent successful \`${event}\` runs: ` +
        `p50 **${formatDuration(percentile(baseline, 0.5))}**, ` +
        `p95 **${formatDuration(percentile(baseline, 0.95))}**.`,
    );
  }

  lines.push(
    "",
    "<details><summary>Phase durations</summary>",
    "",
    "| Job | Phase | Duration |",
    "| --- | --- | ---: |",
  );
  for (const job of finished) {
    for (const phase of jobPhases(job)) {
      lines.push(`| ${job.name} | ${phase.name} | ${formatDuration(phase.seconds)} |`);
    }
  }
  lines.push("</details>", "");

  return lines.join("\n");
}

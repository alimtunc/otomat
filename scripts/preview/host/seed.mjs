import { fileURLToPath } from "node:url";

// Every row is created through the daemon's own HTTP API, so a preview shows daemon state under
// the real contracts instead of fixtures the cockpit would have to invent.
const SEED_ISSUES = [
  {
    title: "Import CSV files that use a semicolon separator",
    body:
      "European exports separate columns with `;`, and the importer splits on `,` only,\n" +
      "so every row lands in one cell. Accept `;` when the header line holds no comma.",
    launch: null,
    status: "ready",
  },
  {
    title: "Rename the export button to Download",
    body: "The toolbar says Export, the menu underneath says Download. Pick one name.",
    launch: "settle",
    status: null,
  },
  {
    title: "Investigate the slow project switcher",
    body:
      "Switching projects takes seconds on a large workspace.\n" +
      "Find what blocks the first paint before changing anything.",
    launch: "abort",
    status: null,
  },
  {
    title: "Write the onboarding page for a new teammate",
    body: "Explain the daemon, the worktrees, and how a run reaches a pull request.",
    launch: null,
    status: "done",
  },
];

const SETTLED_RUN_STATUSES = new Set(["review_ready", "succeeded", "failed", "canceled"]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
  }
  return response.json();
}

/** Null once the daemon answers, else why it never did: a preview that cannot boot must say so. */
async function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      await request(baseUrl, "/health");
      return null;
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }
  return new Error(`${baseUrl}/health never answered`, { cause: lastError });
}

async function waitForSettledRun(baseUrl, runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { run } = await request(baseUrl, `/runs/${runId}`);
    if (SETTLED_RUN_STATUSES.has(run.status)) return run.status;
    await delay(500);
  }
  return null;
}

async function seedIssue(baseUrl, projectId, entry, runTimeoutMs) {
  const issue = await request(baseUrl, "/issues", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, title: entry.title, body: entry.body }),
  });
  if (entry.launch !== null) {
    const { run } = await request(baseUrl, "/runs", {
      method: "POST",
      body: JSON.stringify({ issue_id: issue.id, runtime: "fake" }),
    });
    if (entry.launch === "abort") {
      await request(baseUrl, `/runs/${run.id}/abort`, { method: "POST" });
    }
    await waitForSettledRun(baseUrl, run.id, runTimeoutMs);
  }
  if (entry.status !== null) {
    await request(baseUrl, `/issues/${issue.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: entry.status }),
    });
  }
  return issue.id;
}

/** Fills an empty preview database with issues and simulated runs; a filled one is left alone. */
export async function seedPreview({ baseUrl, healthTimeoutMs = 60_000, runTimeoutMs = 120_000 }) {
  const unhealthy = await waitForHealth(baseUrl, healthTimeoutMs);
  if (unhealthy !== null) throw unhealthy;
  const issues = await request(baseUrl, "/issues");
  if (issues.length > 0) return { seeded: 0, reason: "issues_exist" };
  const projects = await request(baseUrl, "/projects");
  const projectId = projects[0]?.id;
  if (projectId === undefined) return { seeded: 0, reason: "no_project" };

  // Sequential on purpose: a preview container runs on a fraction of a CPU, and each simulated run
  // spawns its own worker process.
  let seeded = 0;
  for (const entry of SEED_ISSUES) {
    await seedIssue(baseUrl, projectId, entry, runTimeoutMs);
    seeded += 1;
  }
  return { seeded, reason: null };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.OTOMAT_DAEMON_PORT ?? "4331";
  seedPreview({ baseUrl: `http://127.0.0.1:${port}/api` })
    .then(({ seeded, reason }) => {
      const detail = reason === null ? "" : ` (${reason})`;
      console.log(`[otomat] preview seed: ${seeded} issues${detail}`);
    })
    .catch((error) => {
      console.error("[otomat] preview seed failed", error);
      process.exitCode = 1;
    });
}

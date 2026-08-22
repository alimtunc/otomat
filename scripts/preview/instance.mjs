#!/usr/bin/env node
// Only provision imports @otomat/domain — lazily — so warm, teardown and inventory run without
// an installed workspace; keep every static import here dependency-free.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { CLIENT_ID_HEADER, CLIENT_SECRET_HEADER } from "./host/gate.mjs";
import {
  isFinalPage,
  isIdempotentDeleteStatus,
  ownedContainerApplications,
  ownedPagesDeployments,
  ownedRegistryImages,
  pagesDeploymentPage,
  previewContainerPullRequest,
  previewPagesPullRequest,
  previewRegistryPullRequest,
  runCleanupTasks,
} from "./resources.mjs";
import {
  PREVIEW_WORKER_PREFIX,
  previewWorkerName,
  previewWorkerPullRequest,
  renderWorkerConfig,
} from "./workers.mjs";

const HOST_DIR = fileURLToPath(new URL("./host/", import.meta.url));
const WRANGLER = ["dlx", "wrangler@4"];
const API = "https://api.cloudflare.com/client/v4";
const MAX_PAGES = 1_000;
const WARM_ATTEMPTS = 18;
const WARM_INTERVAL_MS = 5_000;

function readFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    flags[token.slice(2)] = next === undefined || next.startsWith("--") ? "true" : next;
  }
  return flags;
}

function requireEnv(name) {
  const value = process.env[name] ?? "";
  if (value === "") throw new Error(`${name} is required in the environment`);
  return value;
}

function requirePullRequest(flags) {
  const pullRequest = Number.parseInt(flags.pr ?? "", 10);
  if (!Number.isInteger(pullRequest) || pullRequest <= 0) {
    throw new Error("--pr must be a pull request number");
  }
  return pullRequest;
}

function runWrangler(args, input) {
  const result = spawnSync("pnpm", [...WRANGLER, ...args], {
    encoding: "utf8",
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input,
  });
  if (result.error) throw new Error(`wrangler could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`wrangler ${args[0]} exited ${String(result.status)}`);
}

function readWranglerJson(args) {
  const result = spawnSync("pnpm", [...WRANGLER, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 60_000,
  });
  if (result.error) throw new Error(`wrangler could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`wrangler ${args[0]} exited ${String(result.status)}`);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `wrangler ${args[0]} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed)) throw new Error(`wrangler ${args[0]} returned no array`);
  return parsed;
}

async function cloudflare(method, pathname) {
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body = null;
  if (text !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      body = { errors: [{ message: `non-JSON answer: ${text.slice(0, 200)}` }] };
    }
  }
  return { status: response.status, body };
}

function apiErrors(body) {
  const errors = body !== null && typeof body === "object" ? body.errors : undefined;
  return Array.isArray(errors) ? errors.map((error) => error.message).join("; ") : "";
}

function apiRows(response, label) {
  if (response.status !== 200) {
    throw new Error(`${label} answered ${String(response.status)}: ${apiErrors(response.body)}`);
  }
  const rows = response.body?.result;
  if (!Array.isArray(rows)) throw new Error(`${label} returned no result array`);
  return rows;
}

async function listPagesDeployments(account, project) {
  const deployments = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { base, pathname } = pagesDeploymentPage(account, project, page);
    const response = await cloudflare("GET", pathname);
    const rows = apiRows(response, `listing ${project} deployments`);
    deployments.push(...rows);
    if (isFinalPage(rows, response.body?.result_info, page)) return { base, deployments };
  }
  throw new Error(`listing ${project} deployments exceeded ${String(MAX_PAGES)} pages`);
}

async function provision(flags) {
  const pullRequest = requirePullRequest(flags);
  const build = flags.build ?? "";
  const { PREVIEW_BUILD_SHA } = await import("@otomat/domain");
  if (!PREVIEW_BUILD_SHA.test(build)) {
    throw new Error(`--build must be a 7-hex short sha, got "${build}"`);
  }
  if (!flags.bundle || !existsSync(flags.bundle)) {
    throw new Error("--bundle is required (the daemon deploy tarball)");
  }
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const clientId = requireEnv("PREVIEW_CLIENT_ID");
  const clientSecret = requireEnv("PREVIEW_CLIENT_SECRET");

  rmSync(`${HOST_DIR}daemon`, { recursive: true, force: true });
  mkdirSync(`${HOST_DIR}daemon`, { recursive: true });
  const extract = spawnSync("tar", ["-xzf", flags.bundle, "-C", HOST_DIR], { stdio: "inherit" });
  if (extract.status !== 0) throw new Error(`could not extract ${flags.bundle}`);

  const name = previewWorkerName(pullRequest);
  const config = `${HOST_DIR}wrangler.generated.jsonc`;
  writeFileSync(
    config,
    renderWorkerConfig(readFileSync(`${HOST_DIR}wrangler.jsonc`, "utf8"), name),
  );
  runWrangler([
    "deploy",
    "--config",
    config,
    "--var",
    `PREVIEW_BUILD:${build}`,
    "--var",
    `PREVIEW_CLIENT_ID:${clientId}`,
  ]);
  runWrangler(["secret", "put", "PREVIEW_CLIENT_SECRET", "--name", name], clientSecret);
  console.log(`[preview] ${name} serves PR #${String(pullRequest)} on build ${build}`);
}

async function warm(flags) {
  const pullRequest = requirePullRequest(flags);
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const clientId = requireEnv("PREVIEW_CLIENT_ID");
  const clientSecret = requireEnv("PREVIEW_CLIENT_SECRET");
  const response = await cloudflare("GET", `/accounts/${account}/workers/subdomain`);
  if (response.status !== 200) {
    throw new Error(
      `reading workers.dev subdomain answered ${String(response.status)}: ${apiErrors(response.body)}`,
    );
  }
  const subdomain = response.body?.result?.subdomain;
  if (typeof subdomain !== "string" || subdomain === "") {
    throw new Error("reading workers.dev subdomain returned no subdomain");
  }
  const host = `${previewWorkerName(pullRequest)}.${subdomain}.workers.dev`;
  const url = `https://${host}/api/health`;
  for (let attempt = 1; attempt <= WARM_ATTEMPTS; attempt += 1) {
    const label = `warm attempt ${String(attempt)}/${String(WARM_ATTEMPTS)}`;
    try {
      const probe = await fetch(url, {
        headers: { [CLIENT_ID_HEADER]: clientId, [CLIENT_SECRET_HEADER]: clientSecret },
      });
      if (probe.ok) {
        console.log(`[preview] ${host} answered on attempt ${String(attempt)}`);
        return;
      }
      console.log(`[preview] ${label} answered HTTP ${String(probe.status)}`);
    } catch (error) {
      console.log(
        `[preview] ${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await delay(WARM_INTERVAL_MS);
  }
  throw new Error(`${url} never answered over ${String(WARM_ATTEMPTS)} attempts`);
}

async function deleteWorker(account, pullRequest) {
  const name = previewWorkerName(pullRequest);
  const response = await cloudflare(
    "DELETE",
    `/accounts/${account}/workers/scripts/${name}?force=true`,
  );
  if (!isIdempotentDeleteStatus(response.status)) {
    throw new Error(
      `deleting ${name} answered ${String(response.status)}: ${apiErrors(response.body)}`,
    );
  }
  console.log(`[preview] worker ${name} ${response.status === 404 ? "already absent" : "deleted"}`);
}

// The worker's deletion does not remove its container application, and a leftover application
// refuses the next provision of a reopened pull request.
async function deleteContainerApplications(account, pullRequest) {
  const response = await cloudflare("GET", `/accounts/${account}/containers/applications`);
  const targets = ownedContainerApplications(
    apiRows(response, "listing container applications"),
    pullRequest,
  );
  for (const application of targets) {
    const removed = await cloudflare(
      "DELETE",
      `/accounts/${account}/containers/applications/${application.id}`,
    );
    if (!isIdempotentDeleteStatus(removed.status)) {
      throw new Error(
        `deleting container ${application.name} answered ${String(removed.status)}: ${apiErrors(removed.body)}`,
      );
    }
    console.log(`[preview] container application ${application.name} deleted`);
  }
  if (targets.length === 0) console.log("[preview] container application already absent");
}

async function purgePagesDeployments(account, pullRequest) {
  const project = process.env.CLOUDFLARE_PAGES_PROJECT ?? "";
  if (project === "") {
    console.log("[preview] Pages project unset; no Pages target can be proven");
    return;
  }
  const { base, deployments } = await listPagesDeployments(account, project);
  const targets = ownedPagesDeployments(deployments, pullRequest);
  const failures = [];
  for (const deployment of targets) {
    const removed = await cloudflare("DELETE", `${base}/${deployment.id}?force=true`);
    if (!isIdempotentDeleteStatus(removed.status)) {
      failures.push(
        new Error(
          `deleting Pages deployment ${deployment.id} answered ${String(removed.status)}: ${apiErrors(removed.body)}`,
        ),
      );
    }
  }
  console.log(`[preview] ${String(targets.length - failures.length)} Pages deployment(s) deleted`);
  if (failures.length > 0) throw new AggregateError(failures, "Pages cleanup incomplete");
}

function listPreviewRepositories() {
  return readWranglerJson([
    "containers",
    "images",
    "list",
    "--filter",
    `^${PREVIEW_WORKER_PREFIX}`,
    "--json",
  ]);
}

function deleteRegistryImages(pullRequest) {
  const targets = ownedRegistryImages(listPreviewRepositories(), pullRequest);
  const failures = [];
  for (const image of targets) {
    const removed = spawnSync(
      "pnpm",
      [...WRANGLER, "containers", "images", "delete", image, "-y"],
      { stdio: "inherit", timeout: 60_000 },
    );
    if (removed.error || removed.status !== 0) {
      failures.push(
        new Error(
          `deleting registry image ${image} failed${removed.error ? `: ${removed.error.message}` : ` with exit ${String(removed.status)}`}`,
        ),
      );
    }
  }
  console.log(`[preview] ${String(targets.length - failures.length)} registry image(s) deleted`);
  if (failures.length > 0) throw new AggregateError(failures, "registry cleanup incomplete");
}

async function teardown(flags) {
  const pullRequest = requirePullRequest(flags);
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  await runCleanupTasks([
    ["worker", () => deleteWorker(account, pullRequest)],
    ["container", () => deleteContainerApplications(account, pullRequest)],
    ["Pages", () => purgePagesDeployments(account, pullRequest)],
    ["registry", () => deleteRegistryImages(pullRequest)],
  ]);
}

function addInventoryResource(inventory, pullRequest, type, name) {
  const resources = inventory.get(pullRequest) ?? [];
  resources.push({ type, name });
  inventory.set(pullRequest, resources);
}

async function pullRequestState(pullRequest) {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  if (repository === "" || token === "") return "unknown";
  const response = await fetch(
    `https://api.github.com/repos/${repository}/pulls/${String(pullRequest)}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (response.status === 404) return "missing";
  if (!response.ok)
    throw new Error(`reading PR #${String(pullRequest)} answered ${String(response.status)}`);
  const body = await response.json();
  if (typeof body.merged_at === "string") return "merged";
  return body.state === "open" ? "open" : "closed";
}

async function inventory() {
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const resources = new Map();
  const workers = apiRows(
    await cloudflare("GET", `/accounts/${account}/workers/scripts`),
    "listing workers",
  );
  for (const worker of workers) {
    const pullRequest = previewWorkerPullRequest(worker?.id ?? "");
    if (pullRequest !== null) addInventoryResource(resources, pullRequest, "worker", worker.id);
  }

  const applications = apiRows(
    await cloudflare("GET", `/accounts/${account}/containers/applications`),
    "listing container applications",
  );
  for (const application of applications) {
    const pullRequest = previewContainerPullRequest(application?.name ?? "");
    if (pullRequest !== null) {
      addInventoryResource(resources, pullRequest, "container", application.name);
    }
  }

  const project = process.env.CLOUDFLARE_PAGES_PROJECT ?? "";
  if (project !== "") {
    const { deployments } = await listPagesDeployments(account, project);
    for (const deployment of deployments) {
      const branch = deployment?.deployment_trigger?.metadata?.branch ?? "";
      const pullRequest = previewPagesPullRequest(branch);
      if (pullRequest !== null)
        addInventoryResource(resources, pullRequest, "pages", deployment.id);
    }
  }

  for (const repository of listPreviewRepositories()) {
    const pullRequest = previewRegistryPullRequest(repository?.name ?? "");
    if (pullRequest === null || !Array.isArray(repository.tags)) continue;
    for (const tag of repository.tags) {
      if (typeof tag === "string" && tag !== "") {
        addInventoryResource(resources, pullRequest, "image", `${repository.name}:${tag}`);
      }
    }
  }

  for (const [pullRequest, rows] of [...resources.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    console.log(
      JSON.stringify({
        pull_request: pullRequest,
        state: await pullRequestState(pullRequest),
        resources: rows,
      }),
    );
  }
  if (resources.size === 0) console.log("[preview] no dedicated preview resource found");
}

function failureMessage(error) {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map((failure) => failureMessage(failure))].join(
      "\n  - ",
    );
  }
  return error instanceof Error ? error.message : String(error);
}

const [command, ...rest] = process.argv.slice(2);
const flags = readFlags(rest);
try {
  if (command === "provision") await provision(flags);
  else if (command === "warm") await warm(flags);
  else if (command === "teardown") await teardown(flags);
  else if (command === "inventory") await inventory();
  else
    throw new Error(
      `unknown command "${command ?? ""}"; expected provision, warm, teardown or inventory`,
    );
} catch (error) {
  console.error(`[preview] ${failureMessage(error)}`);
  process.exitCode = 1;
}

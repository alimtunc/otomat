#!/usr/bin/env node
/**
 * Provisions, warms, tears down and lists the per-pull-request preview daemons on Cloudflare.
 * Run from CI (docs/release/web-preview.md); every command is idempotent.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… PREVIEW_CLIENT_ID=… PREVIEW_CLIENT_SECRET=… \
 *     node scripts/preview/instance.mjs provision --pr 142 --build 1a2b3c4 --bundle /tmp/daemon.tar.gz
 *   node scripts/preview/instance.mjs warm --pr 142
 *   node scripts/preview/instance.mjs teardown --pr 142
 *   node scripts/preview/instance.mjs list
 *
 * A pull request owns one Worker; each provision replaces its container image with the commit's
 * own daemon and names the running instance after the build, so a stale container is unreachable
 * rather than answering for the wrong commit.
 *
 * Only provision imports @otomat/domain — lazily — so warm, teardown and list run without an
 * installed workspace; keep every static import here dependency-free.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { CLIENT_ID_HEADER, CLIENT_SECRET_HEADER } from "./host/gate.mjs";
import { previewWorkerName, previewWorkerPullRequest, renderWorkerConfig } from "./workers.mjs";

const HOST_DIR = fileURLToPath(new URL("./host/", import.meta.url));
const WRANGLER = ["dlx", "wrangler@4"];
const API = "https://api.cloudflare.com/client/v4";

function fail(message) {
  console.error(`[preview] ${message}`);
  process.exit(1);
}

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
  if (value === "") fail(`${name} is required in the environment`);
  return value;
}

function requirePullRequest(flags) {
  const pullRequest = Number.parseInt(flags.pr ?? "", 10);
  if (!Number.isInteger(pullRequest) || pullRequest <= 0)
    fail("--pr must be a pull request number");
  return pullRequest;
}

function wrangler(args, input) {
  const result = spawnSync("pnpm", [...WRANGLER, ...args], {
    encoding: "utf8",
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input,
  });
  if (result.error) fail(`wrangler could not run: ${result.error.message}`);
  if (result.status !== 0) fail(`wrangler ${args[0]} exited ${String(result.status)}`);
}

async function cloudflare(method, pathname) {
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON answer is reported through the status alone.
  }
  return { status: response.status, body };
}

function apiErrors(body) {
  const errors = body !== null && typeof body === "object" ? body.errors : undefined;
  return Array.isArray(errors) ? errors.map((error) => error.message).join("; ") : "";
}

async function provision(flags) {
  const pullRequest = requirePullRequest(flags);
  const build = flags.build ?? "";
  const { PREVIEW_BUILD_SHA } = await import("@otomat/domain");
  if (!PREVIEW_BUILD_SHA.test(build)) fail(`--build must be a 7-hex short sha, got "${build}"`);
  if (!flags.bundle || !existsSync(flags.bundle)) {
    fail("--bundle is required (the daemon deploy tarball)");
  }
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const clientId = requireEnv("PREVIEW_CLIENT_ID");
  const clientSecret = requireEnv("PREVIEW_CLIENT_SECRET");

  rmSync(`${HOST_DIR}daemon`, { recursive: true, force: true });
  mkdirSync(`${HOST_DIR}daemon`, { recursive: true });
  const extract = spawnSync("tar", ["-xzf", flags.bundle, "-C", HOST_DIR], { stdio: "inherit" });
  if (extract.status !== 0) fail(`could not extract ${flags.bundle}`);

  const name = previewWorkerName(pullRequest);
  const config = `${HOST_DIR}wrangler.generated.jsonc`;
  writeFileSync(
    config,
    renderWorkerConfig(readFileSync(`${HOST_DIR}wrangler.jsonc`, "utf8"), name),
  );
  wrangler([
    "deploy",
    "--config",
    config,
    "--var",
    `PREVIEW_BUILD:${build}`,
    "--var",
    `PREVIEW_CLIENT_ID:${clientId}`,
  ]);
  wrangler(["secret", "put", "PREVIEW_CLIENT_SECRET", "--name", name], clientSecret);
  console.log(`[preview] ${name} serves the PR #${String(pullRequest)} daemon on build ${build}`);
}

const WARM_ATTEMPTS = 18;
const WARM_DELAY_MS = 5_000;

/**
 * Boots the pull request's container ahead of the first reviewer click. Exits non-zero when the
 * daemon never answers; the workflow step carries continue-on-error, so that is a visible signal,
 * not a red pipeline.
 */
async function warm(flags) {
  const pullRequest = requirePullRequest(flags);
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const clientId = requireEnv("PREVIEW_CLIENT_ID");
  const clientSecret = requireEnv("PREVIEW_CLIENT_SECRET");
  const subdomain = await cloudflare("GET", `/accounts/${account}/workers/subdomain`);
  if (subdomain.status !== 200) {
    fail(
      `reading the workers.dev subdomain answered ${String(subdomain.status)}: ${apiErrors(subdomain.body)}`,
    );
  }
  const host = `${previewWorkerName(pullRequest)}.${subdomain.body.result.subdomain}.workers.dev`;
  const url = `https://${host}/api/health`;
  const probe = async () => {
    try {
      const response = await fetch(url, {
        headers: { [CLIENT_ID_HEADER]: clientId, [CLIENT_SECRET_HEADER]: clientSecret },
      });
      return { answered: response.ok, detail: `HTTP ${String(response.status)}` };
    } catch (error) {
      return { answered: false, detail: error instanceof Error ? error.message : String(error) };
    }
  };
  for (let attempt = 1; attempt <= WARM_ATTEMPTS; attempt += 1) {
    const { answered, detail } = await probe();
    if (answered) {
      console.log(`[preview] ${host} answered on attempt ${String(attempt)}`);
      return;
    }
    console.log(`[preview] attempt ${String(attempt)}/${String(WARM_ATTEMPTS)}: ${detail}`);
    await delay(WARM_DELAY_MS);
  }
  fail(`${url} never answered over ${String(WARM_ATTEMPTS)} attempts`);
}

async function teardown(flags) {
  const pullRequest = requirePullRequest(flags);
  const name = previewWorkerName(pullRequest);
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const removed = await cloudflare(
    "DELETE",
    `/accounts/${account}/workers/scripts/${name}?force=true`,
  );
  if (removed.status === 404) {
    console.log(`[preview] ${name} already holds no worker`);
  } else if (removed.status !== 200) {
    fail(`deleting ${name} answered ${String(removed.status)}: ${apiErrors(removed.body)}`);
  } else {
    console.log(`[preview] ${name} torn down`);
  }
  await purgePagesDeployments(account, pullRequest);
  deleteRegistryImage(name);
}

/** Best-effort: with the worker gone its image is pure storage, and wrangler's beta `containers images` command must never fail an otherwise clean teardown. */
function deleteRegistryImage(name) {
  const result = spawnSync("pnpm", [...WRANGLER, "containers", "images", "delete", name], {
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 60_000,
  });
  if (result.status === 0) {
    console.log(`[preview] registry image ${name} deleted`);
  } else {
    console.log(
      `[preview] registry image ${name} left in place (wrangler exited ${String(result.status)}); \`wrangler containers images list\` finds leftovers`,
    );
  }
}

/** A closed pull request keeps no Pages deployments either; ids are collected before any delete so pagination never shifts under the walk. */
async function purgePagesDeployments(account, pullRequest) {
  const project = process.env.CLOUDFLARE_PAGES_PROJECT ?? "";
  if (project === "") {
    console.log("[preview] CLOUDFLARE_PAGES_PROJECT unset; Pages deployments left in place");
    return;
  }
  const branch = `pr-${String(pullRequest)}`;
  const base = `/accounts/${account}/pages/projects/${project}/deployments`;
  const targets = [];
  const PAGE_BOUND = 40;
  for (let page = 1; page <= PAGE_BOUND; page += 1) {
    const listed = await cloudflare("GET", `${base}?page=${String(page)}&per_page=25`);
    if (listed.status !== 200) {
      fail(
        `listing ${project} deployments answered ${String(listed.status)}: ${apiErrors(listed.body)}`,
      );
    }
    const rows = listed.body.result ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row?.deployment_trigger?.metadata?.branch === branch) targets.push(row.id);
    }
    if (page === PAGE_BOUND) {
      console.log(
        `[preview] stopped listing after ${String(PAGE_BOUND)} pages; older deployments may remain`,
      );
    }
  }
  for (const id of targets) {
    const removed = await cloudflare("DELETE", `${base}/${id}?force=true`);
    if (removed.status !== 200 && removed.status !== 404) {
      fail(
        `deleting deployment ${id} answered ${String(removed.status)}: ${apiErrors(removed.body)}`,
      );
    }
  }
  console.log(`[preview] ${String(targets.length)} Pages deployment(s) of ${branch} purged`);
}

/** Names every preview worker still deployed, so an orphan of a closed pull request is found. */
async function list() {
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const scripts = await cloudflare("GET", `/accounts/${account}/workers/scripts`);
  if (scripts.status !== 200) {
    fail(`listing workers answered ${String(scripts.status)}: ${apiErrors(scripts.body)}`);
  }
  for (const script of scripts.body.result ?? []) {
    const pullRequest = previewWorkerPullRequest(script.id ?? "");
    if (pullRequest === null) continue;
    console.log(`${script.id}\tPR #${String(pullRequest)}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const flags = readFlags(rest);
if (command === "provision") await provision(flags);
else if (command === "warm") await warm(flags);
else if (command === "teardown") await teardown(flags);
else if (command === "list") await list();
else fail(`unknown command "${command ?? ""}"; expected provision, warm, teardown or list`);

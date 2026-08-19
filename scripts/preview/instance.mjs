#!/usr/bin/env node
/**
 * Provisions, tears down and lists the per-pull-request daemon instances a web preview talks to.
 * Run from CI (docs/release/web-preview.md); every command is idempotent, and each one reports the
 * host's own token rather than an exit code alone.
 *
 *   node scripts/preview/instance.mjs provision --host <ssh> --pr 142 --build 1a2b3c4 \
 *     --hostname otomat-pr-{pr}.preview.example.com --bundle /tmp/daemon.tar.gz
 *   node scripts/preview/instance.mjs teardown  --host <ssh> --pr 142
 *   node scripts/preview/instance.mjs list      --host <ssh>
 *
 * The instance keys on the commit, exactly as the desktop preview does, so both reach one daemon
 * per commit instead of two on different ports.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { PREVIEW_BUILD_SHA, previewInstanceDeployment } from "@otomat/domain";

import {
  listScript,
  parseInstances,
  parseOutcome,
  provisionScript,
  teardownScript,
} from "./remote.mjs";

const SSH_ARGS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];

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

function ssh(host, script, input) {
  const result = spawnSync("ssh", [...SSH_ARGS, host, "bash", "-ls"], {
    input: input ?? script,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) fail(`ssh to ${host} failed: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`ssh to ${host} exited ${String(result.status)}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function requireBuild(flags) {
  const build = flags.build ?? "";
  if (!PREVIEW_BUILD_SHA.test(build)) fail(`--build must be a 7-hex short sha, got "${build}"`);
  return build;
}

function requireHost(flags) {
  if (!flags.host) fail("--host is required");
  return flags.host;
}

function requirePullRequest(flags) {
  const pullRequest = Number.parseInt(flags.pr ?? "", 10);
  if (!Number.isInteger(pullRequest) || pullRequest <= 0) fail("--pr must be a pull request number");
  return pullRequest;
}

function report(stdout, expected) {
  const outcome = parseOutcome(stdout);
  if (outcome === null) fail(`the host reported nothing:\n${stdout}`);
  if (outcome.kind !== expected) fail(`${outcome.kind}: ${outcome.detail}`);
  console.log(`[preview] ${outcome.kind} ${outcome.detail}`);
}

function provision(flags) {
  const host = requireHost(flags);
  const build = requireBuild(flags);
  const pullRequest = requirePullRequest(flags);
  if (!flags.hostname) fail("--hostname is required (a pattern containing {pr})");
  if (!flags.bundle) fail("--bundle is required (the daemon deploy tarball)");
  const deployment = previewInstanceDeployment(build);
  const hostname = flags.hostname.replace("{pr}", String(pullRequest));
  // Uploaded before the script runs: the provision step extracts whatever this commit put there.
  ssh(
    host,
    `set -eu; mkdir -p "$HOME/${deployment.homeSuffix}"; cat > "$HOME/${deployment.homeSuffix}/daemon.tar.gz"`,
    readFileSync(flags.bundle),
  );
  report(ssh(host, provisionScript({ ...deployment, hostname, pullRequest, build })), "READY");
  // A pull request owns exactly one instance: the commit just provisioned. Its earlier heads are
  // torn down here, so a pushed branch never leaves a daemon and a route behind per commit.
  for (const stale of instancesOf(host, pullRequest)) {
    if (stale.build === build) continue;
    report(ssh(host, teardownScript(previewInstanceDeployment(stale.build))), "TORN_DOWN");
  }
  console.log(`[preview] https://${hostname} serves the PR #${String(pullRequest)} daemon`);
}

function instancesOf(host, pullRequest) {
  const instances = parseInstances(ssh(host, listScript()));
  if (instances === null) fail("the instance listing was truncated");
  return pullRequest === null
    ? instances
    : instances.filter((instance) => instance.pullRequest === pullRequest);
}

/** `--pr` removes every instance that pull request still holds, whatever commit each was built from. */
function teardown(flags) {
  const host = requireHost(flags);
  if (flags.pr === undefined) {
    report(ssh(host, teardownScript(previewInstanceDeployment(requireBuild(flags)))), "TORN_DOWN");
    return;
  }
  const pullRequest = requirePullRequest(flags);
  const held = instancesOf(host, pullRequest);
  if (held.length === 0) console.log(`[preview] PR #${String(pullRequest)} holds no instance`);
  for (const instance of held) {
    report(ssh(host, teardownScript(previewInstanceDeployment(instance.build))), "TORN_DOWN");
  }
}

function list(flags) {
  for (const instance of instancesOf(requireHost(flags), null)) {
    console.log(
      `${instance.build}\tPR #${String(instance.pullRequest)}\t${instance.hostname}\t${String(instance.port)}`,
    );
  }
}

const [command, ...rest] = process.argv.slice(2);
const flags = readFlags(rest);
if (command === "provision") provision(flags);
else if (command === "teardown") teardown(flags);
else if (command === "list") list(flags);
else fail(`unknown command "${command ?? ""}"; expected provision, teardown or list`);

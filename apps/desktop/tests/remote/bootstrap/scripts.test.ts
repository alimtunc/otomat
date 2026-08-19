import { previewInstanceDeployment } from "@otomat/domain";
import { expect, it } from "vitest";

import {
  deploymentForChannel,
  keepsDataAcrossBuilds,
  LOCAL_DEPLOYMENT,
  parseBootstrapOutput,
  STABLE_DEPLOYMENT,
  startOrVerifyDaemonScript,
  stopDaemonScript,
} from "#main/remote/bootstrap/scripts";

it("keeps one deployment per channel, and the local one across commits", () => {
  const first = deploymentForChannel("local", "1111111");
  const second = deploymentForChannel("local", "2222222");

  expect(first).toEqual(LOCAL_DEPLOYMENT);
  expect(second).toEqual(first);
  expect(first.homeSuffix).toBe(".otomat/local");
  expect(first.homeSuffix).not.toBe(STABLE_DEPLOYMENT.homeSuffix);
  expect(first.port).not.toBe(STABLE_DEPLOYMENT.port);
});

it("isolates a preview per build and a channel-less build from every channel with data", () => {
  const preview = deploymentForChannel("preview", "1111111");
  const other = deploymentForChannel("preview", "2222222");
  const unknown = deploymentForChannel("unknown", "1111111");

  expect(preview).toEqual(previewInstanceDeployment("1111111"));
  expect(preview.homeSuffix).not.toBe(other.homeSuffix);
  // Whatever a build with unreadable metadata thinks its commit is, it stays in the shared slot.
  expect(unknown).toEqual(previewInstanceDeployment(null));
  expect(unknown.homeSuffix).toBe(".otomat/instances/unknown");
  for (const isolated of [preview, other, unknown]) {
    expect(isolated.homeSuffix).not.toBe(STABLE_DEPLOYMENT.homeSuffix);
    expect(isolated.homeSuffix).not.toBe(LOCAL_DEPLOYMENT.homeSuffix);
  }
});

it("drives the host's real daemon from a checkout and from the signed app alike", () => {
  expect(deploymentForChannel("dev", null)).toEqual(STABLE_DEPLOYMENT);
  expect(deploymentForChannel("stable", "1111111")).toEqual(STABLE_DEPLOYMENT);
});

it("protects every deployment that holds data, whichever channel picked it", () => {
  for (const channel of ["dev", "stable", "local"] as const) {
    expect(keepsDataAcrossBuilds(deploymentForChannel(channel, "1111111"))).toBe(true);
  }
  for (const channel of ["preview", "unknown"] as const) {
    expect(keepsDataAcrossBuilds(deploymentForChannel(channel, "1111111"))).toBe(false);
  }
});

it("keeps the remote daemon loopback-bound with the packaged renderer origin allowed", () => {
  const script = startOrVerifyDaemonScript(STABLE_DEPLOYMENT);
  expect(script).toContain("OTOMAT_DAEMON_HOST=127.0.0.1");
  expect(script).toContain(`OTOMAT_DAEMON_PORT=${STABLE_DEPLOYMENT.port}`);
  expect(script).toContain("OTOMAT_ALLOWED_ORIGINS=otomat://app");
  expect(script).not.toContain("0.0.0.0");
});

it("detaches the daemon, verifies it survived boot, and records a pidfile", () => {
  const script = startOrVerifyDaemonScript(STABLE_DEPLOYMENT);
  expect(script).toContain("nohup node");
  expect(script).toContain("< /dev/null &");
  expect(script).toContain('kill -0 "$DAEMON_PID"');
  expect(script).toContain("START_FAILED");
  expect(script).toContain('echo "$DAEMON_PID" > "$PID_FILE"');
});

it.each([
  ["OTOMAT_REMOTE:RUNNING:4242", { kind: "running", pid: 4242 }],
  ["OTOMAT_REMOTE:STARTED:7", { kind: "started", pid: 7 }],
  [
    "OTOMAT_REMOTE:NO_DAEMON:/home/u/.otomat/daemon/dist/index.js",
    { kind: "daemon_missing", entry: "/home/u/.otomat/daemon/dist/index.js" },
  ],
  ["OTOMAT_REMOTE:NO_NODE:-", { kind: "node_missing" }],
  ["OTOMAT_REMOTE:NODE_TOO_OLD:v18.19.0", { kind: "node_too_old", version: "v18.19.0" }],
  [
    "OTOMAT_REMOTE:START_FAILED:EADDRINUSE: address already in use ",
    { kind: "start_failed", logTail: "EADDRINUSE: address already in use" },
  ],
])("parses %s", (line, outcome) => {
  expect(parseBootstrapOutput(line)).toEqual(outcome);
});

it("ignores login-shell noise around the token and keeps the last token", () => {
  const stdout = [
    "Welcome to Ubuntu 24.04 LTS",
    "Last login: Fri Aug  1 10:00:00 2026",
    "OTOMAT_REMOTE:NO_DAEMON:/stale/entry",
    "OTOMAT_REMOTE:STARTED:1234",
    "",
  ].join("\n");
  expect(parseBootstrapOutput(stdout)).toEqual({ kind: "started", pid: 1234 });
});

it.each(["", "no token at all", "OTOMAT_REMOTE:STARTED:not-a-pid", "OTOMAT_REMOTE:UNKNOWN:x"])(
  "returns null for unusable output %j",
  (stdout) => {
    expect(parseBootstrapOutput(stdout)).toBeNull();
  },
);

it("stops by pidfile pid only — never by pattern — and clears the pidfile", () => {
  const script = stopDaemonScript(STABLE_DEPLOYMENT);
  expect(script).toContain('PID="$(cat "$PID_FILE")"');
  expect(script).toContain("kill -9");
  expect(script).toContain('rm -f "$PID_FILE"');
  expect(script).not.toContain("pkill");
  expect(script).toContain("OTOMAT_REMOTE:STOPPED");
});

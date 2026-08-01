import { expect, it } from "vitest";

import {
  parseBootstrapOutput,
  REMOTE_DAEMON_PORT,
  startOrVerifyDaemonScript,
} from "#main/remote/daemon-bootstrap";

it("keeps the remote daemon loopback-bound with the packaged renderer origin allowed", () => {
  const script = startOrVerifyDaemonScript();
  expect(script).toContain("OTOMAT_DAEMON_HOST=127.0.0.1");
  expect(script).toContain(`OTOMAT_DAEMON_PORT=${REMOTE_DAEMON_PORT}`);
  expect(script).toContain("OTOMAT_ALLOWED_ORIGINS=otomat://app");
  expect(script).not.toContain("0.0.0.0");
});

it("detaches the daemon, verifies it survived boot, and records a pidfile", () => {
  const script = startOrVerifyDaemonScript();
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

import { expect, it } from "vitest";

import { LOCAL_DEPLOYMENT, STABLE_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import {
  backupDatabaseScript,
  daemonPresenceScript,
  parseBackupOutput,
  parseDaemonPresence,
  parseRollbackOutput,
  rollbackDaemonScript,
} from "#main/remote/upgrade/scripts";

it("copies the database of the deployment it was asked about, and nothing else", () => {
  const script = backupDatabaseScript(LOCAL_DEPLOYMENT);

  expect(script).toContain('OTOMAT_HOME="$HOME/.otomat/local"');
  expect(script).toContain('DB="$OTOMAT_HOME/data/otomat.db"');
  expect(script).not.toContain(`$HOME/${STABLE_DEPLOYMENT.homeSuffix}"`);
});

it("takes the write-ahead files along and flushes the copy to disk", () => {
  const script = backupDatabaseScript(LOCAL_DEPLOYMENT);

  expect(script).toContain('for FILE in "$DB" "$DB-wal" "$DB-shm"');
  expect(script).toContain("sync");
});

it("reports a fresh deployment as having nothing to back up, never as a success", () => {
  expect(backupDatabaseScript(LOCAL_DEPLOYMENT)).toContain("OTOMAT_BACKUP:NO_DATABASE:-");
});

it.each([
  [
    "OTOMAT_BACKUP:BACKED_UP:/home/u/.otomat/backups/upgrade-1",
    { kind: "backed_up", path: "/home/u/.otomat/backups/upgrade-1" },
  ],
  ["OTOMAT_BACKUP:NO_DATABASE:-", { kind: "no_database" }],
  [
    "OTOMAT_BACKUP:FAILED:No space left on device ",
    { kind: "failed", detail: "No space left on device" },
  ],
])("parses %s", (line, outcome) => {
  expect(parseBackupOutput(line)).toEqual(outcome);
});

it.each(["", "OTOMAT_BACKUP:BACKED_UP:", "OTOMAT_BACKUP:SOMETHING:x", "no token at all"])(
  "returns null for unusable backup output %j",
  (stdout) => {
    expect(parseBackupOutput(stdout)).toBeNull();
  },
);

it("keeps the last backup token, so a login banner cannot be mistaken for one", () => {
  const stdout = [
    "Welcome to Ubuntu 24.04 LTS",
    "OTOMAT_BACKUP:NO_DATABASE:-",
    "OTOMAT_BACKUP:BACKED_UP:/home/u/.otomat/backups/upgrade-2",
    "",
  ].join("\n");

  expect(parseBackupOutput(stdout)).toEqual({
    kind: "backed_up",
    path: "/home/u/.otomat/backups/upgrade-2",
  });
});

it("puts the displaced bundle back and keeps the one that failed", () => {
  const script = rollbackDaemonScript(STABLE_DEPLOYMENT);

  expect(script).toContain('mv "$OTOMAT_HOME/daemon.prev" "$OTOMAT_HOME/daemon"');
  expect(script).toContain('mv "$OTOMAT_HOME/daemon" "$OTOMAT_HOME/daemon.failed"');
  expect(script).toContain("OTOMAT_ROLLBACK:NO_PREVIOUS:-");
});

it("never leaves the deployment without a daemon when the swap back fails", () => {
  const script = rollbackDaemonScript(STABLE_DEPLOYMENT);
  const recovery = script.indexOf('mv "$OTOMAT_HOME/daemon.failed" "$OTOMAT_HOME/daemon"');

  expect(recovery).toBeGreaterThan(-1);
  expect(recovery).toBeLessThan(script.indexOf("OTOMAT_ROLLBACK:FAILED"));
});

it.each([
  ["OTOMAT_ROLLBACK:RESTORED:-", { kind: "restored" }],
  ["OTOMAT_ROLLBACK:NO_PREVIOUS:-", { kind: "no_previous" }],
  ["OTOMAT_ROLLBACK:FAILED:Permission denied ", { kind: "failed", detail: "Permission denied" }],
])("parses %s", (line, outcome) => {
  expect(parseRollbackOutput(line)).toEqual(outcome);
});

it.each(["", "OTOMAT_ROLLBACK:UNKNOWN:x"])(
  "returns null for unusable rollback output %j",
  (stdout) => {
    expect(parseRollbackOutput(stdout)).toBeNull();
  },
);

it("only looks for the daemon entry: it starts, stops and reads nothing else", () => {
  const script = daemonPresenceScript(LOCAL_DEPLOYMENT);

  expect(script).toContain('[ -f "$HOME/.otomat/local/daemon/dist/index.js" ]');
  for (const forbidden of ["nohup", "kill", "rm ", "mv ", "cp "]) {
    expect(script).not.toContain(forbidden);
  }
});

it.each([
  ["OTOMAT_PRESENCE:PRESENT:-", "present"],
  ["OTOMAT_PRESENCE:ABSENT:-", "absent"],
])("parses %s", (line, presence) => {
  expect(parseDaemonPresence(line)).toBe(presence);
});

it.each(["", "OTOMAT_PRESENCE:MAYBE:-", "nothing at all"])(
  "never reads unusable presence output %j as absent",
  (stdout) => {
    expect(parseDaemonPresence(stdout)).toBeNull();
  },
);

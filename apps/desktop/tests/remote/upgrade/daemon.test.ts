import type { ExecutionHostOperationResult } from "@otomat/domain";
import { describe, expect, it } from "vitest";

import { LOCAL_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";
import { upgradeRemoteDaemon } from "#main/remote/upgrade/daemon";
import { FakeRemoteSession, type FakeRemoteSessionOptions } from "#support/remote-session";

const BUILD = "92584b0";
const BACKUP_PATH = "/home/u/.otomat/local/backups/upgrade-20260806T090000Z";

type Step = "probe" | "backup" | "deploy" | "rollback";

const DEFAULT_REPLIES: Record<Step, SshScriptResult> = {
  probe: { code: 0, stdout: "OTOMAT_PRESENCE:PRESENT:-\n", stderr: "" },
  backup: {
    code: 0,
    stdout: `OTOMAT_REMOTE:STOPPED:-\nOTOMAT_BACKUP:BACKED_UP:${BACKUP_PATH}\n`,
    stderr: "",
  },
  deploy: { code: 0, stdout: `OTOMAT_DEPLOY:DEPLOYED:${BUILD}\n`, stderr: "" },
  rollback: { code: 0, stdout: "OTOMAT_ROLLBACK:RESTORED:-\n", stderr: "" },
};

const UPGRADED: FakeRemoteSessionOptions = {
  onRefresh: () => ({ status: { phase: "connected", detail: null }, build: BUILD }),
};

function classify(script: string): Step {
  if (script.includes("OTOMAT_PRESENCE:")) return "probe";
  if (script.includes("OTOMAT_BACKUP:")) return "backup";
  if (script.includes("OTOMAT_ROLLBACK:")) return "rollback";
  return "deploy";
}

/** `/api/runs` as the remote daemon answers it through the tunnel. */
function runsEndpoint(runs: { status: string }[]): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(runs)));
}

interface UpgradeRun {
  result: Promise<ExecutionHostOperationResult>;
  steps: Step[];
  session: FakeRemoteSession;
}

/** Runs a whole upgrade against scripted ssh replies, recording which steps ran and in what order. */
function upgrade(
  overrides: {
    replies?: Partial<Record<Step, SshScriptResult>>;
    session?: FakeRemoteSessionOptions;
    runs?: { status: string }[];
    fetchImpl?: typeof fetch;
  } = {},
): UpgradeRun {
  const steps: Step[] = [];
  const session = new FakeRemoteSession(overrides.session ?? UPGRADED);
  const runScript = (options: RunSshScriptOptions): Promise<SshScriptResult> => {
    const step = classify(options.script);
    steps.push(step);
    return Promise.resolve(overrides.replies?.[step] ?? DEFAULT_REPLIES[step]);
  };
  const result = upgradeRemoteDaemon({
    alias: "otomat-vps",
    deployment: LOCAL_DEPLOYMENT,
    build: BUILD,
    repo: "alimtunc/otomat",
    session,
    runScript,
    fetchImpl: overrides.fetchImpl ?? runsEndpoint(overrides.runs ?? []),
    log: () => {},
  });
  return { result, steps, session };
}

/** The prose a failure carries; the tests read it because it is what the user acts on. */
function messageOf(result: ExecutionHostOperationResult): string {
  if (!("message" in result)) throw new Error("The result carries no message.");
  return result.message;
}

describe("upgradeRemoteDaemon", () => {
  it("stops, backs up, swaps, restarts and only then calls the upgrade done", async () => {
    const run = upgrade();

    expect(await run.result).toEqual({ ok: true });
    expect(run.steps).toEqual(["backup", "deploy"]);
    expect(run.session.refreshes).toBe(1);
  });

  it("never touches a daemon with a run in flight", async () => {
    const run = upgrade({ runs: [{ status: "awaiting_permission" }] });

    expect((await run.result).ok).toBe(false);
    expect(run.steps).toEqual([]);
  });

  it("treats a daemon that does not answer as busy, never as idle", async () => {
    const unreachable: typeof fetch = () => Promise.reject(new Error("ECONNREFUSED"));
    const run = upgrade({ fetchImpl: unreachable });

    expect((await run.result).ok).toBe(false);
    expect(run.steps).toEqual([]);
  });

  it("refuses to touch a deployed daemon it cannot reach", async () => {
    const run = upgrade({ session: { status: { phase: "reconnecting", detail: null } } });

    const result = await run.result;

    expect(result.ok).toBe(false);
    expect(messageOf(result)).toMatch(/Connect to the host first/);
    // It looked, found a daemon, and stopped there: nothing was stopped, backed up or swapped.
    expect(run.steps).toEqual(["probe"]);
  });

  it("refuses when the host cannot say whether a daemon is deployed", async () => {
    const run = upgrade({
      session: { status: { phase: "reconnecting", detail: null } },
      replies: { probe: { code: 0, stdout: "", stderr: "" } },
    });

    expect((await run.result).ok).toBe(false);
    expect(run.steps).toEqual(["probe"]);
  });

  it("installs into a deployment that has no daemon yet", async () => {
    const run = upgrade({
      session: { status: { phase: "error", code: "daemon_missing", detail: null } },
      replies: { probe: { code: 0, stdout: "OTOMAT_PRESENCE:ABSENT:-\n", stderr: "" } },
    });

    expect(await run.result).toEqual({ ok: true });
    // No database exists there yet, so the first install stops and backs up nothing.
    expect(run.steps).toEqual(["probe", "deploy"]);
    expect(run.session.refreshes).toBe(0);
  });

  it("leaves the old daemon running when the database cannot be backed up", async () => {
    const run = upgrade({
      replies: {
        backup: { code: 0, stdout: "OTOMAT_BACKUP:FAILED:No space left on device\n", stderr: "" },
      },
    });

    const result = await run.result;

    expect(result.ok).toBe(false);
    expect(messageOf(result)).toMatch(/No space left on device/);
    expect(messageOf(result)).toMatch(/untouched/);
    expect(run.steps).toEqual(["backup"]);
    expect(run.session.refreshes).toBe(1);
  });

  it("treats a silent backup step as a failure rather than swapping blind", async () => {
    const run = upgrade({ replies: { backup: { code: 0, stdout: "", stderr: "" } } });

    expect((await run.result).ok).toBe(false);
    expect(run.steps).toEqual(["backup"]);
  });

  it("rolls back and names the backup when the new daemon does not come back", async () => {
    const run = upgrade({
      session: { onRefresh: () => ({ status: { phase: "reconnecting", detail: null } }) },
    });

    const result = await run.result;

    expect(result.ok).toBe(false);
    expect(messageOf(result)).toContain(BACKUP_PATH);
    expect(messageOf(result)).toMatch(/previous daemon is back/);
    expect(run.steps).toEqual(["backup", "deploy", "rollback"]);
  });

  it("rolls back when the restarted daemon is not the build that was installed", async () => {
    const run = upgrade({
      session: {
        onRefresh: () => ({ status: { phase: "connected", detail: null }, build: "0000000" }),
      },
    });

    const result = await run.result;

    expect(result.ok).toBe(false);
    expect(messageOf(result)).toMatch(/reports build 0000000/);
    expect(run.steps).toEqual(["backup", "deploy", "rollback"]);
  });

  it("says the previous daemon could not be put back rather than claiming recovery", async () => {
    const run = upgrade({
      session: {
        onRefresh: () => ({ status: { phase: "error", code: "health_failed", detail: null } }),
      },
      replies: { rollback: { code: 0, stdout: "OTOMAT_ROLLBACK:NO_PREVIOUS:-\n", stderr: "" } },
    });

    expect(messageOf(await run.result)).toMatch(/could not be put back/);
  });

  it("still reports the real failure when the restart itself throws", async () => {
    const run = upgrade({
      session: {
        onRefresh: () => {
          throw new Error("ssh exited 255");
        },
      },
      replies: { deploy: { code: 0, stdout: "OTOMAT_DEPLOY:NO_GH:-\n", stderr: "" } },
    });

    const result = await run.result;

    expect(result.ok).toBe(false);
    expect(messageOf(result)).toContain("the host has no");
    expect(messageOf(result)).toContain("unreachable");
    expect(run.steps).toEqual(["backup", "deploy"]);
  });
});

import type { RemoteHostPhase } from "@otomat/domain";
import { describe, expect, it, vi } from "vitest";

import { LOCAL_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";
import { RemoteUpgradeCoordinator } from "#main/remote/upgrade/coordinator";
import { FakeRemoteSession, type FakeRemoteSessionOptions } from "#support/remote-session";

const EXPECTED = "92584b0";
const STALE = "old1111";

const STOPPED_AND_BACKED_UP: SshScriptResult = {
  code: 0,
  stdout: "OTOMAT_REMOTE:STOPPED:-\nOTOMAT_BACKUP:BACKED_UP:/backups/upgrade-1\n",
  stderr: "",
};
const DEPLOYED: SshScriptResult = {
  code: 0,
  stdout: `OTOMAT_DEPLOY:DEPLOYED:${EXPECTED}\n`,
  stderr: "",
};
const INSTALL_REPLIES = [STOPPED_AND_BACKED_UP, DEPLOYED];

interface Harness {
  coordinator: RemoteUpgradeCoordinator;
  session: FakeRemoteSession;
  phases: RemoteHostPhase[];
  scripts: string[];
  /** Fires the pending idle re-check, or throws when the journey never armed one. */
  recheck(): Promise<void>;
}

/** `/api/runs` as the remote daemon answers it through the tunnel; a rejection is a host that cannot say. */
function runsEndpoint(pages: { status: string }[][]): typeof fetch {
  let call = 0;
  return () => {
    const runs = pages[Math.min(call, pages.length - 1)] ?? [];
    call += 1;
    return Promise.resolve(new Response(JSON.stringify(runs)));
  };
}

function harness(
  overrides: {
    session?: FakeRemoteSessionOptions | null;
    expectedBuild?: string | null;
    fetchImpl?: typeof fetch;
    replies?: SshScriptResult[];
  } = {},
): Harness {
  const phases: RemoteHostPhase[] = [];
  const scripts: string[] = [];
  const replies = overrides.replies ?? INSTALL_REPLIES;
  let pending: (() => void) | null = null;
  // What the host would boot next: only a deploy that reported DEPLOYED changes it.
  let installed = STALE;
  const session = new FakeRemoteSession({
    build: STALE,
    onRefresh: () => ({ status: { phase: "connected", detail: null }, build: installed }),
    ...overrides.session,
  });
  const held = overrides.session === null ? null : session;
  const coordinator = new RemoteUpgradeCoordinator({
    expectedBuild: overrides.expectedBuild === undefined ? EXPECTED : overrides.expectedBuild,
    deployment: LOCAL_DEPLOYMENT,
    repo: "alimtunc/otomat",
    alias: () => "otomat-vps",
    session: () => held,
    onStatus: () => {
      const status = coordinator.status;
      if (status !== null) phases.push(status.phase);
    },
    log: () => {},
    fetchImpl: overrides.fetchImpl ?? runsEndpoint([[]]),
    runScript: (options: RunSshScriptOptions): Promise<SshScriptResult> => {
      scripts.push(options.script);
      const reply = replies[scripts.length - 1] ?? {
        code: 1,
        stdout: "",
        stderr: "unexpected script",
      };
      if (reply.stdout.includes("OTOMAT_DEPLOY:DEPLOYED:")) installed = EXPECTED;
      return Promise.resolve(reply);
    },
    scheduleRecheck: (callback) => {
      pending = callback;
      return 0 as unknown as NodeJS.Timeout;
    },
  });
  return {
    coordinator,
    session,
    phases,
    scripts,
    recheck: async () => {
      const callback = pending;
      if (callback === null) throw new Error("No idle re-check was armed.");
      pending = null;
      callback();
      await vi.waitFor(() => expect(coordinator.status).toBeNull());
    },
  };
}

describe("RemoteUpgradeCoordinator", () => {
  it("installs the expected build on an idle host, without anyone opening Settings", async () => {
    const test = harness();

    await test.coordinator.update();

    expect(test.session.remoteBuild).toBe(EXPECTED);
    expect(test.coordinator.error).toBeNull();
    expect(test.coordinator.status).toBeNull();
    expect(
      test.scripts.some((script) => script.includes(`otomat-daemon-${EXPECTED}-linux-x64`)),
    ).toBe(true);
  });

  it("walks the journey through version check, install and verify", async () => {
    const test = harness();

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.session.remoteBuild).toBe(EXPECTED));

    expect(test.phases).toEqual(["checking_version", "installing_update", "verifying_update"]);
  });

  it("leaves a matching build alone, without ever announcing a journey", async () => {
    const test = harness({ session: { build: EXPECTED } });

    test.coordinator.observe();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(test.phases).toEqual([]);
    expect(test.scripts).toEqual([]);
  });

  it("waits for the runs in flight, naming how many, and installs once the host is idle", async () => {
    const test = harness({
      fetchImpl: runsEndpoint([[{ status: "running" }, { status: "queued" }], []]),
    });

    test.coordinator.observe();
    await vi.waitFor(() =>
      expect(test.coordinator.status).toEqual({
        phase: "waiting_for_runs",
        active_runs: 2,
        detail: null,
      }),
    );
    expect(test.scripts).toEqual([]);

    await test.recheck();

    expect(test.session.remoteBuild).toBe(EXPECTED);
  });

  it("treats a daemon that cannot list its runs as busy rather than swapping its bundle", async () => {
    const test = harness({
      fetchImpl: () => Promise.reject(new Error("ECONNREFUSED")),
    });

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.status?.phase).toBe("waiting_for_runs"));

    expect(test.coordinator.status).toEqual({
      phase: "waiting_for_runs",
      active_runs: 0,
      detail: "the daemon did not answer",
    });
    expect(test.scripts).toEqual([]);
  });

  it("keeps the working daemon and the exact cause when the artifact is missing", async () => {
    const test = harness({
      replies: [
        STOPPED_AND_BACKED_UP,
        {
          code: 0,
          stdout: `OTOMAT_DEPLOY:NOT_FOUND:otomat-daemon-${EXPECTED}-linux-x64\n`,
          stderr: "",
        },
      ],
    });

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.error).not.toBeNull());

    expect(test.coordinator.error).toMatch(
      /no CI artifact is named otomat-daemon-92584b0-linux-x64/,
    );
    expect(test.coordinator.error).toMatch(/artifacts expire after 7 days/);
    expect(test.session.remoteBuild).toBe(STALE);
  });

  it("never retries a failed install by itself, and installs again when asked to", async () => {
    const test = harness({
      replies: [
        STOPPED_AND_BACKED_UP,
        { code: 0, stdout: "OTOMAT_DEPLOY:NO_GH:-\n", stderr: "" },
        ...INSTALL_REPLIES,
      ],
    });

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.error).not.toBeNull());
    const attempted = test.scripts.length;

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.status).toBeNull());
    expect(test.scripts).toHaveLength(attempted);

    expect((await test.coordinator.update()).ok).toBe(true);
    expect(test.session.remoteBuild).toBe(EXPECTED);
    expect(test.coordinator.error).toBeNull();
  });

  it("lets go of a waiting journey when the app closes, and picks it up on the next connect", async () => {
    const test = harness({
      fetchImpl: runsEndpoint([[{ status: "running" }], []]),
    });
    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.status?.phase).toBe("waiting_for_runs"));

    test.coordinator.stop();

    expect(test.coordinator.status).toBeNull();
    expect(test.scripts).toEqual([]);
    expect(test.session.remoteBuild).toBe(STALE);

    // What a relaunched client does: connect, then observe — by then the run has finished.
    test.coordinator.observe();
    await vi.waitFor(() => expect(test.session.remoteBuild).toBe(EXPECTED));
  });

  it("refuses a manual update on a host that has no session at all", async () => {
    const test = harness({ session: null });

    const result = await test.coordinator.update();

    expect(result).toEqual({ ok: false, message: expect.stringMatching(/not connected/) });
    expect(test.scripts).toEqual([]);
  });

  it("stays out of a host this app cannot name a build for", async () => {
    const test = harness({ expectedBuild: null });

    test.coordinator.observe();
    const manual = await test.coordinator.update();

    expect(manual.ok).toBe(false);
    expect(test.scripts).toEqual([]);
  });

  it("says nothing while the session is not connected: the journey resumes on its next connect", async () => {
    const test = harness({
      session: { build: STALE, status: { phase: "reconnecting", detail: null } },
    });

    test.coordinator.observe();
    await vi.waitFor(() => expect(test.coordinator.status).toBeNull());

    expect(test.phases).toEqual([]);
    expect(test.scripts).toEqual([]);
  });
});

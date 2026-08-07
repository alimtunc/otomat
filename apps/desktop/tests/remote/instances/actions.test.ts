import { describe, expect, it } from "vitest";

import {
  deploymentForChannel,
  instanceDeployment,
  LOCAL_DEPLOYMENT,
  STABLE_DEPLOYMENT,
  type RemoteDeployment,
} from "#main/remote/bootstrap/scripts";
import { RemoteInstanceActions } from "#main/remote/instances/actions";
import type { RemoteSessionHandle } from "#main/remote/session";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";
import { FakeRemoteSession } from "#support/remote-session";

function actionsWith(
  respond: (options: RunSshScriptOptions) => SshScriptResult,
  overrides: {
    alias?: string | null;
    expectedBuild?: string | null;
    deployment?: RemoteDeployment;
    session?: RemoteSessionHandle | null;
    fetchImpl?: typeof fetch;
  } = {},
): { actions: RemoteInstanceActions; scripts: string[] } {
  const scripts: string[] = [];
  const actions = new RemoteInstanceActions({
    alias: () => (overrides.alias === undefined ? "otomat-vps" : overrides.alias),
    deployment: overrides.deployment ?? STABLE_DEPLOYMENT,
    expectedBuild: overrides.expectedBuild === undefined ? "92584b0" : overrides.expectedBuild,
    repo: "alimtunc/otomat",
    session: () => overrides.session ?? null,
    log: () => {},
    runScript: (options) => {
      scripts.push(options.script);
      return Promise.resolve(respond(options));
    },
    ...(overrides.fetchImpl === undefined ? {} : { fetchImpl: overrides.fetchImpl }),
  });
  return { actions, scripts };
}

/** `/api/runs` as the remote daemon answers it through the tunnel. */
function runsEndpoint(runs: { status: string }[]): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(runs)));
}

const ok = (stdout: string): SshScriptResult => ({ code: 0, stdout, stderr: "" });

describe("RemoteInstanceActions", () => {
  it("lists instances with their derived ports", async () => {
    const { actions } = actionsWith(() =>
      ok("OTOMAT_INSTANCE:92584b0:yes:2048\nOTOMAT_INSTANCES_END:-\n"),
    );

    const result = await actions.list();

    expect(result).toEqual({
      ok: true,
      instances: [
        {
          build: "92584b0",
          running: true,
          size_kb: 2048,
          port: instanceDeployment("92584b0").port,
        },
      ],
    });
  });

  it("treats a truncated listing as a failure, never as an empty host", async () => {
    const { actions } = actionsWith(() => ok("OTOMAT_INSTANCE:92584b0:yes:2048\n"));

    const result = await actions.list();

    expect(result.ok).toBe(false);
  });

  it.each(["stop", "remove"] as const)(
    "refuses an instance key that is not a build identifier for %s",
    async (method) => {
      const { actions, scripts } = actionsWith(() => ok(""));

      const result = await actions[method]("$(rm -rf ~)");

      expect(result.ok).toBe(false);
      expect(scripts).toHaveLength(0);
    },
  );

  it.each(["stop", "remove"] as const)(
    "refuses to %s the instance this app itself is attached to",
    async (method) => {
      const { actions, scripts } = actionsWith(() => ok(""), {
        deployment: instanceDeployment("92584b0"),
      });

      const refused = await actions[method]("92584b0");
      const allowed = await actions.stop("dec9431");

      expect(refused.ok).toBe(false);
      expect("message" in refused && refused.message).toMatch(/own instance/);
      expect(allowed).toEqual({ ok: true });
      expect(scripts).toHaveLength(1);
    },
  );

  it("filters host directories that are not instances out of the listing", async () => {
    const { actions } = actionsWith(() =>
      ok(
        "OTOMAT_INSTANCE:backup:no:512\nOTOMAT_INSTANCE:92584b0:yes:2048\nOTOMAT_INSTANCES_END:-\n",
      ),
    );

    const result = await actions.list();

    expect(result.ok).toBe(true);
    expect(result.ok && result.instances.map((entry) => entry.build)).toEqual(["92584b0"]);
  });

  it("stops an instance through its own deployment, never the stable one", async () => {
    const { actions, scripts } = actionsWith(() => ok("OTOMAT_REMOTE:STOPPED:-\n"));

    const result = await actions.stop("92584b0");

    expect(result).toEqual({ ok: true });
    expect(scripts[0]).toContain(".otomat/instances/92584b0");
  });

  it("deploys the expected build and surfaces an expired artifact honestly", async () => {
    const preview = { deployment: instanceDeployment("92584b0") };
    const missing = actionsWith(
      () => ok("OTOMAT_DEPLOY:NOT_FOUND:otomat-daemon-92584b0-linux-x64\n"),
      preview,
    );
    const deployed = actionsWith(() => ok("OTOMAT_DEPLOY:DEPLOYED:92584b0\n"), preview);

    const failure = await missing.actions.updateDaemon();
    const success = await deployed.actions.updateDaemon();

    expect(failure.ok).toBe(false);
    expect("message" in failure && failure.message).toMatch(/expire/);
    expect(success).toEqual({ ok: true });
    expect(deployed.scripts[0]).toContain("otomat-daemon-92584b0-linux-x64");
  });

  it("upgrades in place on a deployment whose data outlives the build", async () => {
    const session = new FakeRemoteSession({
      onRefresh: () => ({ status: { phase: "connected", detail: null }, build: "92584b0" }),
    });
    const { actions, scripts } = actionsWith(
      (options) =>
        ok(
          options.script.includes("OTOMAT_BACKUP")
            ? "OTOMAT_REMOTE:STOPPED:-\nOTOMAT_BACKUP:BACKED_UP:/home/u/.otomat/local/backups/upgrade-1\n"
            : "OTOMAT_DEPLOY:DEPLOYED:92584b0\n",
        ),
      {
        deployment: LOCAL_DEPLOYMENT,
        session,
        fetchImpl: runsEndpoint([{ status: "completed" }]),
      },
    );

    const result = await actions.updateDaemon();

    expect(result).toEqual({ ok: true });
    expect(scripts[0]).toContain("OTOMAT_BACKUP");
    expect(scripts[0]).toContain(".otomat/local");
    expect(scripts[1]).toContain("otomat-daemon-92584b0-linux-x64");
    expect(session.refreshes).toBe(1);
  });

  // A checkout drives the same `~/.otomat` as the stable app, so it takes the same protected path:
  // the deployment decides, never the channel that picked it.
  it("backs up rather than bare-deploys when a dev checkout targets the stable deployment", async () => {
    const { actions, scripts } = actionsWith(
      (options) =>
        ok(
          options.script.includes("OTOMAT_BACKUP")
            ? "OTOMAT_REMOTE:STOPPED:-\nOTOMAT_BACKUP:BACKED_UP:/home/u/.otomat/backups/upgrade-1\n"
            : "OTOMAT_DEPLOY:DEPLOYED:92584b0\n",
        ),
      {
        deployment: deploymentForChannel("dev", null),
        session: new FakeRemoteSession({
          onRefresh: () => ({ status: { phase: "connected", detail: null }, build: "92584b0" }),
        }),
        fetchImpl: runsEndpoint([]),
      },
    );

    const result = await actions.updateDaemon();

    expect(result).toEqual({ ok: true });
    expect(scripts[0]).toContain("OTOMAT_BACKUP");
    expect(scripts[0]).toContain('OTOMAT_HOME="$HOME/.otomat"');
    expect(scripts[1]).toContain("otomat-daemon-92584b0-linux-x64");
  });

  it("never stops a daemon that keeps its data while a run is in flight", async () => {
    const { actions, scripts } = actionsWith(() => ok(""), {
      session: new FakeRemoteSession(),
      fetchImpl: runsEndpoint([{ status: "running" }]),
    });

    const result = await actions.updateDaemon();

    expect(result.ok).toBe(false);
    expect(scripts).toHaveLength(0);
  });

  it("refuses to upgrade when the remote daemon is not connected", async () => {
    const { actions, scripts } = actionsWith(() => ok(""), {
      deployment: LOCAL_DEPLOYMENT,
      session: null,
    });

    const result = await actions.updateDaemon();

    expect(result.ok).toBe(false);
    expect("message" in result && result.message).toMatch(/not connected/);
    expect(scripts).toHaveLength(0);
  });

  it("refuses to deploy when the app cannot name its own build", async () => {
    const { actions, scripts } = actionsWith(() => ok(""), { expectedBuild: null });

    const result = await actions.updateDaemon();

    expect(result.ok).toBe(false);
    expect(scripts).toHaveLength(0);
  });

  it("degrades every action when no host is configured", async () => {
    const { actions } = actionsWith(() => ok(""), { alias: null });

    expect((await actions.list()).ok).toBe(false);
    expect((await actions.updateDaemon()).ok).toBe(false);
  });
});

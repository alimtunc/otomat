import { describe, expect, it } from "vitest";

import { instanceDeployment, STABLE_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import { RemoteInstanceActions } from "#main/remote/instances/actions";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";

function actionsWith(
  respond: (options: RunSshScriptOptions) => SshScriptResult,
  overrides: { alias?: string | null; expectedBuild?: string | null } = {},
): { actions: RemoteInstanceActions; scripts: string[] } {
  const scripts: string[] = [];
  const actions = new RemoteInstanceActions({
    alias: () => (overrides.alias === undefined ? "otomat-vps" : overrides.alias),
    deployment: STABLE_DEPLOYMENT,
    expectedBuild: overrides.expectedBuild === undefined ? "92584b0" : overrides.expectedBuild,
    repo: "alimtunc/otomat",
    log: () => {},
    runScript: (options) => {
      scripts.push(options.script);
      return Promise.resolve(respond(options));
    },
  });
  return { actions, scripts };
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

  it("refuses an instance key that is not a build identifier", async () => {
    const { actions, scripts } = actionsWith(() => ok(""));

    const result = await actions.remove("$(rm -rf ~)");

    expect(result.ok).toBe(false);
    expect(scripts).toHaveLength(0);
  });

  it("stops an instance through its own deployment, never the stable one", async () => {
    const { actions, scripts } = actionsWith(() => ok("OTOMAT_REMOTE:STOPPED:-\n"));

    const result = await actions.stop("92584b0");

    expect(result).toEqual({ ok: true });
    expect(scripts[0]).toContain(".otomat/instances/92584b0");
  });

  it("deploys the expected build and surfaces an expired artifact honestly", async () => {
    const missing = actionsWith(() =>
      ok("OTOMAT_DEPLOY:NOT_FOUND:otomat-daemon-92584b0-linux-x64\n"),
    );
    const deployed = actionsWith(() => ok("OTOMAT_DEPLOY:DEPLOYED:92584b0\n"));

    const failure = await missing.actions.updateDaemon();
    const success = await deployed.actions.updateDaemon();

    expect(failure.ok).toBe(false);
    expect("message" in failure && failure.message).toMatch(/expire/);
    expect(success).toEqual({ ok: true });
    expect(deployed.scripts[0]).toContain("otomat-daemon-92584b0-linux-x64");
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

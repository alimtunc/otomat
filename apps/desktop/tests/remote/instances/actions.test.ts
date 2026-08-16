import { describe, expect, it } from "vitest";

import {
  instanceDeployment,
  STABLE_DEPLOYMENT,
  type RemoteDeployment,
} from "#main/remote/bootstrap/scripts";
import { RemoteInstanceActions } from "#main/remote/instances/actions";
import type { RunSshScriptOptions, SshScriptResult } from "#main/remote/ssh/script";

function actionsWith(
  respond: (options: RunSshScriptOptions) => SshScriptResult,
  overrides: { alias?: string | null; deployment?: RemoteDeployment } = {},
): { actions: RemoteInstanceActions; scripts: string[] } {
  const scripts: string[] = [];
  const actions = new RemoteInstanceActions({
    alias: () => (overrides.alias === undefined ? "otomat-vps" : overrides.alias),
    deployment: overrides.deployment ?? STABLE_DEPLOYMENT,
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

  it("degrades every action when no host is configured", async () => {
    const { actions } = actionsWith(() => ok(""), { alias: null });

    expect((await actions.list()).ok).toBe(false);
    expect((await actions.stop("92584b0")).ok).toBe(false);
  });
});

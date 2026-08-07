import { describe, expect, it } from "vitest";

import { instanceDeployment, STABLE_DEPLOYMENT } from "#main/remote/bootstrap/scripts";
import {
  deleteInstanceScript,
  deployDaemonScript,
  listInstancesScript,
  parseDeployOutput,
  parseInstanceList,
} from "#main/remote/instances/scripts";

describe("instanceDeployment", () => {
  it("keys the home and port on the build, disjoint from the stable deployment", () => {
    const deployment = instanceDeployment("92584b0");

    expect(deployment.homeSuffix).toBe(".otomat/instances/92584b0");
    expect(deployment.port).not.toBe(STABLE_DEPLOYMENT.port);
    expect(deployment).toEqual(instanceDeployment("92584b0"));
  });

  it("never falls back to the stable deployment for an unidentifiable build", () => {
    const deployment = instanceDeployment(null);

    expect(deployment.homeSuffix).toBe(".otomat/instances/unknown");
    expect(deployment.homeSuffix).not.toBe(STABLE_DEPLOYMENT.homeSuffix);
  });
});

describe("deployDaemonScript", () => {
  it("targets the deployment home and the artifact named after the build", () => {
    const script = deployDaemonScript({
      deployment: instanceDeployment("92584b0"),
      build: "92584b0",
      repo: "alimtunc/otomat",
    });

    expect(script).toContain('OTOMAT_HOME="$HOME/.otomat/instances/92584b0"');
    expect(script).toContain("otomat-daemon-92584b0-linux-x64");
    expect(script).toContain("repos/alimtunc/otomat/actions/artifacts");
  });

  it("guards the lookup and the swap so a failure never reads as deployed", () => {
    const script = deployDaemonScript({
      deployment: STABLE_DEPLOYMENT,
      build: "92584b0",
      repo: "alimtunc/otomat",
    });

    expect(script).toContain('if ! ID="$(gh api');
    expect(script).toContain('if ! mv "$TMP/x/daemon"');
    expect(script).toContain('if ! mv "$OTOMAT_HOME/daemon.next"');
  });

  it("keeps the bundle it displaced, so an upgrade has something to roll back to", () => {
    const script = deployDaemonScript({
      deployment: STABLE_DEPLOYMENT,
      build: "92584b0",
      repo: "alimtunc/otomat",
    });
    const swap = script.indexOf('if ! mv "$OTOMAT_HOME/daemon.next"');

    expect(script).toContain('mv "$OTOMAT_HOME/daemon" "$OTOMAT_HOME/daemon.prev"');
    // The only cleanup of a previous bundle is the one before this deploy's own swap.
    expect(script.lastIndexOf('rm -rf "$OTOMAT_HOME/daemon.next"')).toBeLessThan(swap);
    expect(script.slice(swap)).not.toContain("rm -rf");
  });
});

describe("parseDeployOutput", () => {
  it("reads the outcome through login-shell noise", () => {
    expect(parseDeployOutput("motd noise\nOTOMAT_DEPLOY:DEPLOYED:92584b0\n")).toEqual({
      kind: "deployed",
      build: "92584b0",
    });
    expect(parseDeployOutput("OTOMAT_DEPLOY:NOT_FOUND:otomat-daemon-x-linux-x64\n")).toEqual({
      kind: "artifact_not_found",
      name: "otomat-daemon-x-linux-x64",
    });
    expect(parseDeployOutput("OTOMAT_DEPLOY:NO_GH:-\n")).toEqual({ kind: "gh_missing" });
    expect(parseDeployOutput("nothing reported\n")).toBeNull();
  });
});

describe("parseInstanceList", () => {
  it("parses rows and requires the END token", () => {
    const stdout = [
      "banner",
      "OTOMAT_INSTANCE:92584b0:yes:14336",
      "OTOMAT_INSTANCE:unknown:no:8",
      "OTOMAT_INSTANCES_END:-",
    ].join("\n");

    expect(parseInstanceList(stdout)).toEqual([
      { build: "92584b0", running: true, sizeKb: 14336 },
      { build: "unknown", running: false, sizeKb: 8 },
    ]);
    expect(parseInstanceList("OTOMAT_INSTANCE:92584b0:yes:1\n")).toBeNull();
    expect(parseInstanceList(listInstancesScript())).toBeNull();
  });
});

describe("deleteInstanceScript", () => {
  it("kills only a verified pid and removes the instance directory", () => {
    const script = deleteInstanceScript("92584b0");

    expect(script).toContain('DIR="$HOME/.otomat/instances/92584b0"');
    expect(script).toContain("/proc/$PID/cmdline");
    expect(script).toContain('rm -rf "$DIR"');
  });
});

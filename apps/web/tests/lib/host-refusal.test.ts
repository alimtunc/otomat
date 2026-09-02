// @vitest-environment happy-dom
import { DaemonTransportError } from "@otomat/client";
import { activeHostStore } from "@web/lib/active-host";
import { agentConfigRefusalMessage } from "@web/lib/agent/config-error";
import { presetRefusalMessage } from "@web/lib/workflow/preset-error";
import { afterEach, beforeEach, expect, it } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";

function unreachable(): DaemonTransportError {
  return new DaemonTransportError("POST", "/api/agent-profiles", new Error("ECONNREFUSED"));
}

beforeEach(() => {
  window.otomat = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  activeHostStore.setState(() => ({ id: "remote", daemonUrl: "http://127.0.0.1:45010" }));
});

afterEach(() => {
  activeHostStore.setState(() => null);
  delete window.otomat;
});

it("names the host that did not answer, so a refused profile write is not read as a lost catalog", () => {
  const message = agentConfigRefusalMessage(unreachable(), "the profile");

  expect(message).toContain("otomat-vps did not answer");
  expect(message).toContain("no other host was touched");
});

it("names the host that did not answer on a refused preset write too", () => {
  const message = presetRefusalMessage(unreachable(), "save the preset");

  expect(message).toContain("otomat-vps did not answer");
  expect(message).toContain("no other host was touched");
});

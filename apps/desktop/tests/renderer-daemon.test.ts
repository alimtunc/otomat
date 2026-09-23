import { expect, it, vi } from "vitest";

import { RendererDaemon } from "#main/renderer-daemon";
import { DAEMON_TOKEN_CHANGED_CHANNEL } from "#shared/ipc-channels";

function harness(allowed: string[]) {
  const state = { daemonUrl: "", daemonToken: "" };
  const cockpit = { send: vi.fn(), reload: vi.fn() };
  const renderer = new RendererDaemon(state, { allows: (url) => allowed.includes(url) }, cockpit);
  return { state, cockpit, renderer };
}

it("pushes a token to the loaded cockpit only when it changes", () => {
  const { state, cockpit, renderer } = harness([]);

  renderer.point({ baseUrl: "http://127.0.0.1:4319", token: "local-token" });
  renderer.point({ baseUrl: "http://127.0.0.1:4319", token: "local-token" });
  renderer.point();

  expect(state).toEqual({ daemonUrl: "", daemonToken: "" });
  expect(cockpit.send.mock.calls).toEqual([
    [DAEMON_TOKEN_CHANGED_CHANNEL, "local-token"],
    [DAEMON_TOKEN_CHANGED_CHANNEL, ""],
  ]);
  expect(cockpit.reload).not.toHaveBeenCalled();
});

it("reloads the cockpit only for an origin its CSP does not name", () => {
  const { cockpit, renderer } = harness(["http://127.0.0.1:45010"]);

  renderer.follow({ baseUrl: "http://127.0.0.1:45010", token: "remote-token" });
  expect(cockpit.reload).not.toHaveBeenCalled();

  renderer.follow({ baseUrl: "http://127.0.0.1:46000", token: "remote-token" });
  expect(cockpit.reload).toHaveBeenCalledOnce();
});

import { expect, it, vi } from "vitest";

import { buildIpcActions, type IpcActionContext } from "#main/ipc-actions";
import type { DesktopRuntime } from "#main/runtime";
import type { DesktopSupport } from "#main/support";

function makeContext(options: {
  activeHostId: "local" | "remote";
  reset: () => Promise<{ ok: true; message: null }>;
}) {
  const reloadCockpit = vi.fn();
  // SAFETY: the reset action only reads the active host id and calls sandbox.reset.
  const runtime = {
    hosts: { activeHostId: options.activeHostId },
    sandbox: { reset: options.reset },
  } as DesktopRuntime;
  const context: IpcActionContext = {
    runtime: () => runtime,
    // SAFETY: the actions under test never touch the support surface.
    support: {} as DesktopSupport,
    restoreBackup: async () => {},
    reloadCockpit,
  };
  return { actions: buildIpcActions(context), reloadCockpit };
}

it("refuses to reset while a remote host is active, touching nothing", async () => {
  const reset = vi.fn(async () => ({ ok: true as const, message: null }));
  const { actions, reloadCockpit } = makeContext({ activeHostId: "remote", reset });

  const result = await actions.resetSandbox();

  expect(result.ok).toBe(false);
  expect(result.message).toContain("local sandbox");
  expect(reset).not.toHaveBeenCalled();
  expect(reloadCockpit).not.toHaveBeenCalled();
});

it("resets the local sandbox and reloads the cockpit on the local host", async () => {
  const reset = vi.fn(async () => ({ ok: true as const, message: null }));
  const { actions, reloadCockpit } = makeContext({ activeHostId: "local", reset });

  const result = await actions.resetSandbox();

  expect(result.ok).toBe(true);
  expect(reset).toHaveBeenCalledOnce();
  expect(reloadCockpit).toHaveBeenCalledOnce();
});

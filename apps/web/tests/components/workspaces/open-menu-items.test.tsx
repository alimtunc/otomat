// @vitest-environment happy-dom
import type { ExecutionHostDescriptor, WorkspaceEntry } from "@otomat/domain";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, IconButton } from "@otomat/ui";
import { WorkspaceOpenMenuItems } from "@web/components/workspaces/open-menu-items";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findLabelled, findMenuItem } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { workspaceEntry } from "#support/workspace";

const LOCAL: ExecutionHostDescriptor = { id: "local", label: "Local", kind: "local" };
const REMOTE: ExecutionHostDescriptor = { id: "remote", label: "otomat-vps", kind: "ssh" };

const toastError = vi.fn();

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@otomat/ui")>()),
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  delete window.otomat;
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

async function renderMenu(entry: WorkspaceEntry | null, host: ExecutionHostDescriptor) {
  const mounted = await mountWithQuery(
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton label="Open" icon={<span />} />} />
      <DropdownMenuContent>
        <WorkspaceOpenMenuItems entry={entry} host={host} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  cleanups.push(mounted.cleanup);
  await act(async () => {
    findLabelled("Open")?.click();
  });
}

it("asks the main process to open exactly the listed path", async () => {
  const openWorkspace = vi.fn(() => Promise.resolve({ ok: true as const }));
  const bridge = fakeDesktopBridge();
  window.otomat = { ...bridge, executionHost: { ...bridge.executionHost, openWorkspace } };
  await renderMenu(workspaceEntry({ id: "a", path: "/tmp/work tree/a" }), LOCAL);

  await act(async () => {
    findMenuItem("Open in VS Code")?.click();
  });

  expect(openWorkspace).toHaveBeenCalledWith("local", "/tmp/work tree/a", "vscode");
});

it("disables both actions when no worktree exists, creating nothing", async () => {
  const openWorkspace = vi.fn(() => Promise.resolve({ ok: true as const }));
  const bridge = fakeDesktopBridge();
  window.otomat = { ...bridge, executionHost: { ...bridge.executionHost, openWorkspace } };
  await renderMenu(null, LOCAL);

  const vscode = findMenuItem("Open in VS Code");
  expect(vscode?.getAttribute("aria-disabled")).toBe("true");
  expect(vscode?.title).toBe("No worktree exists for this work yet.");
  expect(findMenuItem("Open in terminal")?.getAttribute("aria-disabled")).toBe("true");
  await act(async () => {
    vscode?.click();
  });
  expect(openWorkspace).not.toHaveBeenCalled();
});

it("offers a copyable ssh command instead of a remote terminal", async () => {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.otomat = fakeDesktopBridge({ executionHostSshAlias: "otomat-vps" });
  await renderMenu(workspaceEntry({ id: "a", path: "/home/ubuntu/wt" }), REMOTE);

  expect(findMenuItem("Open in VS Code")?.getAttribute("aria-disabled")).toBeNull();
  expect(findMenuItem("Open in terminal")?.getAttribute("aria-disabled")).toBe("true");
  await act(async () => {
    findMenuItem("Copy ssh command")?.click();
  });

  expect(writeText).toHaveBeenCalledWith(
    `ssh -t otomat-vps 'cd '\\''/home/ubuntu/wt'\\'' && exec "$SHELL" -l'`,
  );
});

it("surfaces the main process's refusal as a toast", async () => {
  const bridge = fakeDesktopBridge();
  window.otomat = {
    ...bridge,
    executionHost: {
      ...bridge.executionHost,
      openWorkspace: () =>
        Promise.resolve({ ok: false as const, message: "VS Code is not installed." }),
    },
  };
  await renderMenu(workspaceEntry({ id: "a" }), LOCAL);

  await act(async () => {
    findMenuItem("Open in VS Code")?.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(toastError).toHaveBeenCalledWith("VS Code is not installed.");
});

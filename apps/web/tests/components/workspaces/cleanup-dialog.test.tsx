// @vitest-environment happy-dom
import type { WorkspaceCleanupResult, WorkspaceEntry } from "@otomat/domain";
import { WorkspaceCleanupDialog } from "@web/components/workspaces/cleanup-dialog";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { workspaceEntry } from "#support/workspace";

const cleanupWorkspace =
  vi.fn<(workspaceId: string, force: boolean) => Promise<WorkspaceCleanupResult>>();

vi.mock("@web/api/client", () => ({
  daemon: {
    cleanupWorkspace: (workspaceId: string, force: boolean) => cleanupWorkspace(workspaceId, force),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
  vi.clearAllMocks();
});

function row(id: string, over: Partial<WorkspaceEntry> = {}): WorkspaceRow {
  return {
    ...workspaceEntry({ id, ...over }),
    host: { id: "local", label: "Local", kind: "local" },
  };
}

function result(
  outcome: WorkspaceCleanupResult["outcome"],
  message: string,
): WorkspaceCleanupResult {
  return { outcome, blocker: null, message, entry: null };
}

async function renderDialog(rows: WorkspaceRow[]) {
  const mounted = await mountWithQuery(
    <WorkspaceCleanupDialog rows={rows} open onOpenChange={() => {}} />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("summarises every target before asking for the confirmation", async () => {
  await renderDialog([
    row("a", { unpushed_commits: 3, pull_request: { number: 7, url: null, merged: true } }),
    row("b"),
  ]);

  expect(document.body.textContent).toContain("otomat/run/a");
  expect(document.body.textContent).toContain("otomat/run/b");
  expect(document.body.textContent).toContain("3 commits only this branch holds");
  expect(document.body.textContent).toContain("#7 merged");
  expect(findButton("Delete 2 workspaces")).toBeDefined();
  expect(cleanupWorkspace).not.toHaveBeenCalled();
});

it("reports every outcome by row and totals them without pretending success", async () => {
  cleanupWorkspace.mockImplementation(async (workspaceId) => {
    if (workspaceId === "a") return result("cleaned", "worktree removed");
    if (workspaceId === "b") return result("skipped", "the issue reopened its cycle");
    throw new Error("daemon unreachable");
  });
  await renderDialog([row("a"), row("b"), row("c")]);

  await act(async () => {
    findButton("Delete 3 workspaces")?.click();
  });

  expect(cleanupWorkspace.mock.calls.map((call) => call[0])).toEqual(["a", "b", "c"]);
  expect(document.body.textContent).toContain("the issue reopened its cycle");
  expect(document.body.textContent).toContain("1 cleaned · 1 skipped · 1 failed");
  expect(findButton("Close")).toBeDefined();
});

it("forces nothing until the operator confirms the exact work it discards", async () => {
  cleanupWorkspace.mockResolvedValue(result("cleaned", "worktree removed"));
  await renderDialog([
    row("dirty", { blocker: "worktree_dirty", uncommitted_files: 4, unpushed_commits: 2 }),
  ]);

  const armed = findButton("Force delete 1 workspace");
  expect(armed).toBeDefined();
  expect(armed?.getAttribute("disabled")).not.toBeNull();
  expect(document.body.textContent).toContain(
    "Discard 4 uncommitted files and 2 commits nothing else holds in 1 worktree",
  );

  await act(async () => {
    armed?.click();
  });

  expect(cleanupWorkspace).not.toHaveBeenCalled();

  await act(async () => {
    document.body.querySelector<HTMLElement>("[role='checkbox']")?.click();
  });
  await act(async () => {
    findButton("Force delete 1 workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("dirty", true);
});

it("keeps the protective deletion on offer while a dirty target waits for its confirmation", async () => {
  cleanupWorkspace.mockResolvedValue(result("cleaned", "worktree removed"));
  await renderDialog([
    row("clean"),
    row("dirty", { blocker: "worktree_dirty", uncommitted_files: 1 }),
  ]);

  expect(findButton("Delete 1 workspace")?.getAttribute("disabled")).toBeNull();

  await act(async () => {
    findButton("Force the 1 git refuses…")?.click();
  });

  const armed = findButton("Force delete 2 workspaces");
  expect(armed?.getAttribute("disabled")).not.toBeNull();

  await act(async () => {
    document.body.querySelector<HTMLElement>("[role='checkbox']")?.click();
  });
  await act(async () => {
    findButton("Force delete 2 workspaces")?.click();
  });

  expect(cleanupWorkspace.mock.calls).toEqual([
    ["clean", true],
    ["dirty", true],
  ]);
});

it("leaves out what no confirmation may delete, and says so", async () => {
  cleanupWorkspace.mockResolvedValue(result("cleaned", "worktree removed"));
  await renderDialog([
    row("ok"),
    row("external", {
      state: "unmanaged",
      provenance: "external_worktree",
      blocker: "unmanaged_worktree",
    }),
  ]);

  expect(document.body.textContent).toContain("1 workspace cannot be deleted here, forced or not");

  await act(async () => {
    findButton("Delete 1 workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledTimes(1);
  expect(cleanupWorkspace).toHaveBeenCalledWith("ok", false);
});

it("carries on to the next target after the first host call is rejected", async () => {
  cleanupWorkspace.mockImplementation(async (workspaceId) => {
    if (workspaceId === "a") throw new Error("daemon unreachable");
    return result("cleaned", "Removed.");
  });
  await renderDialog([row("a"), row("b")]);

  await act(async () => {
    findButton("Delete 2 workspaces")?.click();
  });

  expect(cleanupWorkspace.mock.calls.map(([workspaceId]) => workspaceId)).toEqual(["a", "b"]);
  expect(document.body.textContent).toContain("1 cleaned · 1 failed");
});

it("sends a target another host holds through the bridge, force decision included", async () => {
  const bridge = fakeDesktopBridge();
  const viaBridge = vi.spyOn(bridge.executionHost, "cleanupWorkspace");
  window.otomat = bridge;
  const remote = {
    ...row("a", { blocker: "worktree_dirty", uncommitted_files: 2 }),
    host: { id: "remote" as const, label: "otomat-vps", kind: "ssh" as const },
  };
  await renderDialog([remote]);

  await act(async () => {
    document.body.querySelector<HTMLElement>("[role='checkbox']")?.click();
  });
  await act(async () => {
    findButton("Force delete 1 workspace")?.click();
  });

  expect(viaBridge).toHaveBeenCalledWith("remote", "a", true);
  expect(cleanupWorkspace).not.toHaveBeenCalled();
});

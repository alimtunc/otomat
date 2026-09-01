// @vitest-environment happy-dom
import type { WorkspaceCleanupResult } from "@otomat/domain";
import { BulkCleanupDialog } from "@web/components/settings/workspaces/bulk-cleanup-dialog";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { workspaceEntry } from "#support/workspace";

const cleanupWorkspace = vi.fn<(worktreeId: string) => Promise<WorkspaceCleanupResult>>();

vi.mock("@web/api/client", () => ({
  daemon: { cleanupWorkspace: (worktreeId: string) => cleanupWorkspace(worktreeId) },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

const entry = (id: string): WorkspaceRow => ({
  ...workspaceEntry({ id }),
  host: { id: "local", label: "Local", kind: "local" },
});

function result(
  outcome: WorkspaceCleanupResult["outcome"],
  message: string,
): WorkspaceCleanupResult {
  return { outcome, blocker: null, message, entry: null };
}

async function renderDialog(rows: WorkspaceRow[]) {
  const mounted = await mountWithQuery(
    <BulkCleanupDialog rows={rows} open onOpenChange={() => {}} />,
  );
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("names every branch it would delete before asking for the confirmation", async () => {
  await renderDialog([entry("a"), entry("b")]);

  expect(document.body.textContent).toContain("otomat/run/a");
  expect(document.body.textContent).toContain("otomat/run/b");
  expect(findButton("Delete 2 workspaces")).toBeDefined();
  expect(cleanupWorkspace).not.toHaveBeenCalled();
});

it("reports every outcome by row and totals them without pretending success", async () => {
  cleanupWorkspace.mockImplementation(async (worktreeId) => {
    if (worktreeId === "a") return result("cleaned", "worktree removed");
    if (worktreeId === "b") return result("skipped", "the issue reopened its cycle");
    throw new Error("daemon unreachable");
  });
  await renderDialog([entry("a"), entry("b"), entry("c")]);

  await act(async () => {
    findButton("Delete 3 workspaces")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledTimes(3);
  expect(document.body.textContent).toContain("the issue reopened its cycle");
  expect(document.body.textContent).toContain("1 cleaned · 1 skipped · 1 failed");
  expect(findButton("Close")).toBeDefined();
});

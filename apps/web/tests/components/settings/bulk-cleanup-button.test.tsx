// @vitest-environment happy-dom
import type { WorkspaceCleanupResult } from "@otomat/domain";
import { BulkCleanupWorkspacesButton } from "@web/components/settings/workspaces/bulk-cleanup-button";
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

it("keeps the receipt on screen when the refetch empties the cleanable list", async () => {
  cleanupWorkspace.mockResolvedValue({
    outcome: "cleaned",
    blocker: null,
    message: "worktree removed",
    entry: null,
  });
  const mounted = await mountWithQuery(
    <BulkCleanupWorkspacesButton
      rows={[
        { ...workspaceEntry({ id: "a" }), host: { id: "local", label: "Local", kind: "local" } },
      ]}
    />,
  );
  cleanups.push(mounted.cleanup);

  await act(async () => {
    findButton("Clean up 1…")?.click();
  });
  await act(async () => {
    findButton("Delete 1 workspace")?.click();
  });
  await mounted.rerender(<BulkCleanupWorkspacesButton rows={[]} />);

  expect(document.body.textContent).toContain("1 cleaned");
  expect(findButton("Close")).toBeDefined();
});

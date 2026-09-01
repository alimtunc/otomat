// @vitest-environment happy-dom
import type { WorkspaceCleanupResult } from "@otomat/domain";
import { BulkCleanupStrip } from "@web/components/settings/workspaces/bulk-cleanup-strip";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { workspaceEntry } from "#support/workspace";

const cleanableRow = (id: string): WorkspaceRow => ({
  ...workspaceEntry({ id }),
  host: { id: "local", label: "Local", kind: "local" },
});

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
  const mounted = await mountWithQuery(<BulkCleanupStrip rows={[cleanableRow("a")]} />);
  cleanups.push(mounted.cleanup);

  expect(document.body.textContent).toContain(
    "1 worktree has a merged pull request and is safe to delete.",
  );
  await act(async () => {
    findButton("Clean up 1")?.click();
  });
  await act(async () => {
    findButton("Delete 1 workspace")?.click();
  });
  await mounted.rerender(<BulkCleanupStrip rows={[]} />);

  expect(document.body.textContent).toContain("1 cleaned");
  expect(findButton("Close")).toBeDefined();
});

it("pluralises the receipt sentence for several cleanable worktrees", async () => {
  const mounted = await mountWithQuery(
    <BulkCleanupStrip rows={[cleanableRow("a"), cleanableRow("b")]} />,
  );
  cleanups.push(mounted.cleanup);

  expect(document.body.textContent).toContain(
    "2 worktrees have merged pull requests and are safe to delete.",
  );
  expect(findButton("Clean up 2")).toBeDefined();
});

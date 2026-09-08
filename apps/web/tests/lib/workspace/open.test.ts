import type { ExecutionHostDescriptor } from "@otomat/domain";
import { remoteShellCommand, workspaceOpenAvailability } from "@web/lib/workspace/open";
import { expect, it } from "vitest";

import { workspaceEntry } from "#support/workspace";

const LOCAL: ExecutionHostDescriptor = { id: "local", label: "Local", kind: "local" };
const REMOTE: ExecutionHostDescriptor = { id: "remote", label: "otomat-vps", kind: "ssh" };

it("offers both actions for a present local worktree", () => {
  const entry = workspaceEntry({ id: "a" });
  expect(workspaceOpenAvailability(entry, LOCAL, "vscode").available).toBe(true);
  expect(workspaceOpenAvailability(entry, LOCAL, "terminal").available).toBe(true);
});

it("says there is no worktree instead of inventing one", () => {
  expect(workspaceOpenAvailability(null, LOCAL, "vscode")).toEqual({
    available: false,
    reason: "No worktree exists for this work yet.",
  });
});

it("names the host a missing directory belongs to", () => {
  const entry = workspaceEntry({ id: "a", present: false });
  expect(workspaceOpenAvailability(entry, REMOTE, "vscode").reason).toBe(
    "The worktree directory is missing on otomat-vps.",
  );
});

it("keeps VS Code for a remote worktree and disables the terminal with the way out", () => {
  const entry = workspaceEntry({ id: "a" });
  expect(workspaceOpenAvailability(entry, REMOTE, "vscode").available).toBe(true);
  expect(workspaceOpenAvailability(entry, REMOTE, "terminal")).toEqual({
    available: false,
    reason: "No terminal integration exists for otomat-vps; copy the ssh command instead.",
  });
});

it("single-quotes the path so nothing in it is ever parsed as a command", () => {
  const command = remoteShellCommand("otomat-vps", "/home/u/it's; rm -rf $HOME `x`/wt");
  expect(command).toBe(
    `ssh -t otomat-vps 'cd '\\''/home/u/it'\\''\\'\\'''\\''s; rm -rf $HOME \`x\`/wt'\\'' && exec "$SHELL" -l'`,
  );
});

import { resolvedAgentConfigSchema, type ExecutionHostDescriptor } from "@otomat/domain";
import {
  codexResumeCommand,
  remoteShellCommand,
  workspaceOpenAvailability,
} from "@web/lib/workspace/open";
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

it("copies explicit Codex permissions, with every session and path byte shell-quoted", () => {
  const config = resolvedAgentConfigSchema.parse({
    runtime: "codex",
    profile_id: null,
    profile_name: null,
    options: { sandbox: "danger-full-access", approval_policy: "never", reasoning_effort: "high" },
    model: { id: "gpt-5.6-sol", source: "discovered" },
    guidance: null,
    skills: [],
    config_hash: "frozen",
  });
  expect(codexResumeCommand("thread;$(x)", config, "/work/it's here")).toBe(
    `'codex' 'resume' '--cd' '/work/it'\\''s here' '--sandbox' 'danger-full-access' '--ask-for-approval' 'never' '--model' 'gpt-5.6-sol' '-c' 'model_reasoning_effort="high"' '--' 'thread;$(x)'`,
  );
  expect(codexResumeCommand("thread", { ...config, options: {}, model: null }, "/work")).toBe(
    "'codex' 'resume' '--cd' '/work' '--' 'thread'",
  );
  const reviewed = codexResumeCommand(
    "thread",
    {
      ...config,
      options: {
        sandbox: "read-only",
        approval_policy: "on-request",
        approvals_reviewer: "auto_review",
      },
    },
    "/work",
  );
  expect(reviewed).toContain(
    "'--sandbox' 'read-only' '--ask-for-approval' 'on-request' '-c' 'approvals_reviewer=\"auto_review\"'",
  );
  expect(reviewed).not.toContain("--approve-for-me");
  expect(reviewed).not.toContain("danger-full-access");
});

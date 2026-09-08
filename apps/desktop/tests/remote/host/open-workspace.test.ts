import { countWorkspaces, type WorkspaceEntry, type WorkspaceInventory } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import { openWorkspace, type WorkspaceLaunchers } from "#main/remote/host/open-workspace";
import { buildExecutionHostActions } from "#main/remote/ipc-actions";

const SPACED = "/Users/alim/work tree's #1 ?/wt";

function entry(over: Partial<WorkspaceEntry>): WorkspaceEntry {
  return {
    id: "wt-1",
    repository_id: "repo-1",
    repository_name: "otomat",
    repository_path: "/Users/alim/otomat",
    issue_id: "i1",
    issue_identifier: "OTO-163",
    issue_title: "Open",
    run_id: "r1",
    branch: "otomat/run/r1",
    path: SPACED,
    state: "active",
    provenance: "otomat_run",
    blocker: "cycle_open",
    reason: "",
    registered: true,
    present: true,
    uncommitted_files: 0,
    unpushed_commits: 0,
    head_sha: null,
    last_activity_at: null,
    pull_request: null,
    ...over,
  };
}

function inventory(entries: WorkspaceEntry[]): WorkspaceInventory {
  return { entries, counts: countWorkspaces(entries) };
}

function launchers(over: Partial<WorkspaceLaunchers> = {}) {
  const fake: WorkspaceLaunchers = {
    platform: "darwin",
    protocolHandler: vi.fn(() => "Visual Studio Code"),
    openExternal: vi.fn(() => Promise.resolve()),
    launch: vi.fn(() => Promise.resolve()),
    ...over,
  };
  return fake;
}

function options(entries: WorkspaceEntry[], fake: WorkspaceLaunchers, alias: string | null = null) {
  return {
    readWorkspaces: vi.fn(() => Promise.resolve({ ok: true as const, value: inventory(entries) })),
    remoteSshAlias: () => alias,
    launchers: fake,
  };
}

it("opens exactly the listed worktree in VS Code, with every path byte encoded", async () => {
  const fake = launchers();

  const result = await openWorkspace(options([entry({})], fake), "local", SPACED, "vscode");

  expect(result).toEqual({ ok: true });
  expect(fake.openExternal).toHaveBeenCalledWith(
    "vscode://file/Users/alim/work%20tree's%20%231%20%3F/wt",
  );
  expect(fake.launch).not.toHaveBeenCalled();
});

it("opens the local terminal with an argument array, never a shell string", async () => {
  const fake = launchers();

  const result = await openWorkspace(options([entry({})], fake), "local", SPACED, "terminal");

  expect(result).toEqual({ ok: true });
  expect(fake.launch).toHaveBeenCalledWith("open", ["-a", "Terminal", SPACED]);
});

it("refuses a path the daemon does not list, touching no launcher", async () => {
  const fake = launchers();

  const result = await openWorkspace(
    options([entry({})], fake),
    "local",
    "/Users/alim/otomat",
    "vscode",
  );

  expect(result).toEqual({
    ok: false,
    message: "This path is not a worktree the host's daemon knows about.",
  });
  expect(fake.openExternal).not.toHaveBeenCalled();
  expect(fake.launch).not.toHaveBeenCalled();
});

it("refuses a worktree whose directory is gone instead of opening its parent", async () => {
  const fake = launchers();

  const result = await openWorkspace(
    options([entry({ present: false })], fake),
    "local",
    SPACED,
    "terminal",
  );

  expect(result.ok).toBe(false);
  expect(result).toMatchObject({ message: expect.stringContaining("missing on local") });
  expect(fake.launch).not.toHaveBeenCalled();
});

it("names the missing application when nothing handles vscode:// links", async () => {
  const fake = launchers({ protocolHandler: () => "" });

  const result = await openWorkspace(options([entry({})], fake), "local", SPACED, "vscode");

  expect(result).toEqual({
    ok: false,
    message: "VS Code is not installed, or nothing handles vscode:// links.",
  });
  expect(fake.openExternal).not.toHaveBeenCalled();
});

it("carries the launcher's own failure when the terminal cannot start", async () => {
  const fake = launchers({ launch: () => Promise.reject(new Error("spawn open ENOENT")) });

  const result = await openWorkspace(options([entry({})], fake), "local", SPACED, "terminal");

  expect(result).toEqual({ ok: false, message: "Terminal did not open: spawn open ENOENT" });
});

it("opens a remote worktree through VS Code Remote-SSH on the registered alias only", async () => {
  const fake = launchers();

  const result = await openWorkspace(
    options([entry({ path: "/home/ubuntu/wt 1" })], fake, "otomat-vps"),
    "remote",
    "/home/ubuntu/wt 1",
    "vscode",
  );

  expect(result).toEqual({ ok: true });
  expect(fake.openExternal).toHaveBeenCalledWith(
    "vscode://vscode-remote/ssh-remote+otomat-vps/home/ubuntu/wt%201",
  );
});

it("refuses a remote VS Code launch when no SSH alias is registered", async () => {
  const fake = launchers();

  const result = await openWorkspace(
    options([entry({ path: "/home/ubuntu/wt" })], fake),
    "remote",
    "/home/ubuntu/wt",
    "vscode",
  );

  expect(result).toEqual({
    ok: false,
    message: "No SSH alias is registered for the remote host.",
  });
  expect(fake.openExternal).not.toHaveBeenCalled();
});

it("has no remote terminal integration and says so", async () => {
  const fake = launchers();

  const result = await openWorkspace(
    options([entry({ path: "/home/ubuntu/wt" })], fake, "otomat-vps"),
    "remote",
    "/home/ubuntu/wt",
    "terminal",
  );

  expect(result).toMatchObject({ ok: false, message: expect.stringContaining("copy the ssh") });
  expect(fake.launch).not.toHaveBeenCalled();
});

it("relays an unreachable host instead of guessing its worktrees", async () => {
  const fake = launchers();
  const result = await openWorkspace(
    {
      readWorkspaces: () => Promise.resolve({ ok: false, message: "tunnel down" }),
      remoteSshAlias: () => "otomat-vps",
      launchers: fake,
    },
    "remote",
    "/home/ubuntu/wt",
    "vscode",
  );

  expect(result).toEqual({ ok: false, message: "tunnel down" });
  expect(fake.openExternal).not.toHaveBeenCalled();
});

it("rejects malformed renderer input before any host is consulted", async () => {
  const manager = vi.fn(() => null);
  const actions = buildExecutionHostActions(
    manager,
    () => null,
    () => null,
  );
  const fake = launchers();

  expect(await actions.openWorkspace("mars", SPACED, "vscode", fake)).toEqual({
    ok: false,
    message: "Unknown execution host.",
  });
  expect(await actions.openWorkspace("local", 42, "vscode", fake)).toEqual({
    ok: false,
    message: "Unknown worktree path.",
  });
  expect(await actions.openWorkspace("local", SPACED, "rm -rf", fake)).toEqual({
    ok: false,
    message: "Unknown open target.",
  });
  expect(manager).not.toHaveBeenCalled();
  expect(fake.openExternal).not.toHaveBeenCalled();
});

it("degrades honestly before the runtime exists", async () => {
  const actions = buildExecutionHostActions(
    () => null,
    () => null,
    () => null,
  );

  expect(await actions.openWorkspace("local", SPACED, "vscode", launchers())).toEqual({
    ok: false,
    message: "The desktop runtime is not ready yet.",
  });
});

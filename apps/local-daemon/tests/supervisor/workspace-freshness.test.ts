import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { runGit } from "#git/git-cli";
import { findActiveByOwner } from "#git/worktrees-store";
import type { Supervisor } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { appendStepInput, makeSupervisor } from "../support/supervisor.js";

const IDENTITY = ["-c", "user.name=Elsewhere", "-c", "user.email=elsewhere@otomat.local"];

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

interface Launched {
  supervisor: Supervisor;
  runId: string;
  path: string;
  branch: string;
}

async function launch(): Promise<Launched> {
  const { supervisor } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "build it" });
  await supervisor.settle();
  const worktree = findActiveByOwner(fix.db, run.id);
  if (!worktree) throw new Error("the launch left no worktree");
  return { supervisor, runId: run.id, path: worktree.path, branch: worktree.branch };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await runGit(args, { cwd })).stdout.trim();
}

async function commitIn(cwd: string, file: string, content: string): Promise<string> {
  writeFileSync(join(cwd, file), content);
  await git(cwd, "add", "-A");
  await git(cwd, ...IDENTITY, "commit", "-m", `write ${file}`);
  return git(cwd, "rev-parse", "HEAD");
}

async function publish({ path, branch }: Launched): Promise<void> {
  await git(path, "push", "--quiet", "--set-upstream", "origin", `HEAD:refs/heads/${branch}`);
}

async function pushElsewhere(branch: string, file: string, content: string): Promise<string> {
  const clone = mkdtempSync(join(tmpdir(), "otomat-elsewhere-"));
  try {
    const url = fix.repo.git("remote", "get-url", "origin").trim();
    await git(tmpdir(), "clone", "--quiet", "--branch", branch, url, clone);
    const pushed = await commitIn(clone, file, content);
    await git(clone, "push", "--quiet", "origin", `HEAD:refs/heads/${branch}`);
    return pushed;
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
}

it("answers up to date when neither the published branch nor the base moved", async () => {
  const run = await launch();
  await commitIn(run.path, "feature.md", "work\n");
  await publish(run);

  expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
    state: "up_to_date",
    branch: { ref: `origin/${run.branch}`, ahead: 0, behind: 0, strategies: [] },
    base: { ref: "origin/main", ahead: 1, behind: 0, strategies: [] },
    dirty: false,
  });
});

it("detects a pull request branch pushed elsewhere and fast-forwards onto it", async () => {
  const run = await launch();
  await commitIn(run.path, "feature.md", "work\n");
  await publish(run);
  await pushElsewhere(run.branch, "review-fix.md", "from GitHub\n");

  expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
    state: "behind",
    branch: { ahead: 0, behind: 1, strategies: ["merge"] },
  });

  const updated = await run.supervisor.updateWorkspace(run.runId, {
    source: "branch",
    strategy: "merge",
  });

  expect(updated).toMatchObject({ state: "up_to_date", branch: { ahead: 0, behind: 0 } });
  expect(readFileSync(join(run.path, "review-fix.md"), "utf8")).toBe("from GitHub\n");
  expect(existsSync(join(run.path, "feature.md"))).toBe(true);
});

it("detects an advanced base and merges it without rewriting the published branch", async () => {
  const run = await launch();
  const local = await commitIn(run.path, "feature.md", "work\n");
  await publish(run);
  await pushElsewhere("main", "on-main.md", "merged elsewhere\n");

  expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
    state: "behind",
    branch: { behind: 0 },
    base: { ahead: 1, behind: 1, strategies: ["merge"] },
  });

  const updated = await run.supervisor.updateWorkspace(run.runId, {
    source: "base",
    strategy: "merge",
  });

  expect(updated).toMatchObject({ state: "up_to_date", base: { behind: 0 }, branch: { ahead: 2 } });
  expect(await git(run.path, "rev-parse", "HEAD^1")).toBe(local);
  expect(existsSync(join(run.path, "on-main.md"))).toBe(true);
});

it("offers a rebase onto the base only while the branch was never published", async () => {
  const run = await launch();
  await commitIn(run.path, "feature.md", "work\n");
  const main = await pushElsewhere("main", "on-main.md", "merged elsewhere\n");

  expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
    state: "behind",
    branch: null,
    base: { behind: 1, strategies: ["rebase", "merge"] },
  });

  await run.supervisor.updateWorkspace(run.runId, { source: "base", strategy: "rebase" });

  expect(await git(run.path, "rev-parse", "HEAD^")).toBe(main);
  expect(await git(run.path, "log", "-1", "--format=%s")).toBe("write feature.md");
});

it("reports a divergence with both counts and rebases the local commits onto the remote ones", async () => {
  const run = await launch();
  await commitIn(run.path, "feature.md", "work\n");
  await publish(run);
  await commitIn(run.path, "local.md", "not pushed yet\n");
  await pushElsewhere(run.branch, "remote.md", "pushed elsewhere\n");

  expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
    state: "diverged",
    branch: { ahead: 1, behind: 1, strategies: ["rebase", "merge"] },
  });

  const updated = await run.supervisor.updateWorkspace(run.runId, {
    source: "branch",
    strategy: "rebase",
  });

  expect(updated).toMatchObject({ state: "up_to_date", branch: { ahead: 1, behind: 0 } });
  expect(existsSync(join(run.path, "local.md"))).toBe(true);
  expect(existsSync(join(run.path, "remote.md"))).toBe(true);
});

it.each(["rebase", "merge"] as const)(
  "aborts a %s that conflicts and leaves the workspace exactly as it was",
  async (strategy) => {
    const run = await launch();
    await commitIn(run.path, "shared.md", "base\n");
    await publish(run);
    const local = await commitIn(run.path, "shared.md", "local edit\n");
    await pushElsewhere(run.branch, "shared.md", "remote edit\n");

    await expect(
      run.supervisor.updateWorkspace(run.runId, { source: "branch", strategy }),
    ).rejects.toMatchObject({
      name: "WorkspaceUpdateRefusedError",
      code: "update_conflict",
      conflicts: ["shared.md"],
    });

    expect(await git(run.path, "rev-parse", "HEAD")).toBe(local);
    expect(await git(run.path, "status", "--porcelain")).toBe("");
    expect(readFileSync(join(run.path, "shared.md"), "utf8")).toBe("local edit\n");
    expect(await run.supervisor.workspaceFreshness(run.runId)).toMatchObject({
      state: "diverged",
    });
  },
);

it("refuses to update over uncommitted work and keeps it", async () => {
  const run = await launch();
  await publish(run);
  await pushElsewhere(run.branch, "remote.md", "pushed elsewhere\n");
  writeFileSync(join(run.path, "draft.md"), "unsaved\n");

  await expect(
    run.supervisor.updateWorkspace(run.runId, { source: "branch", strategy: "merge" }),
  ).rejects.toMatchObject({ code: "workspace_dirty" });
  expect(readFileSync(join(run.path, "draft.md"), "utf8")).toBe("unsaved\n");
  expect(existsSync(join(run.path, "remote.md"))).toBe(false);
});

it("says the remote could not be read instead of reporting the workspace as current", async () => {
  const run = await launch();
  fix.repo.git("remote", "set-url", "origin", join(fix.repo.root, "..", "gone.git"));

  expect(await run.supervisor.workspaceFreshness(run.runId)).toEqual({
    state: "unverifiable",
    failure: {
      message: expect.any(String),
      remote: expect.objectContaining({ failure: "not_found" }),
    },
  });
  await expect(
    run.supervisor.updateWorkspace(run.runId, { source: "base", strategy: "merge" }),
  ).rejects.toMatchObject({ code: "remote_unavailable", remote: { failure: "not_found" } });
});

it("refuses a follow-up or a resume while the workspace is being updated", async () => {
  const run = await launch();
  fix.repo.git("config", "protocol.ext.allow", "always");
  fix.repo.git("remote", "set-url", "origin", "ext::sh -c sleep% 1");

  const update = run.supervisor.updateWorkspace(run.runId, { source: "base", strategy: "merge" });
  const refusal = { name: "LaunchRefusedError", code: "workspace_updating" };

  await expect(run.supervisor.resume(run.runId)).rejects.toMatchObject(refusal);
  await expect(run.supervisor.appendStep(run.runId, appendStepInput())).rejects.toMatchObject(
    refusal,
  );
  await expect(update).rejects.toMatchObject({ code: "remote_unavailable" });
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { worktreeStateTree } from "#git/diff";
import { GIT_ISOLATION_ENV_VARS, runGit } from "#git/git-cli";

import { setupTestRepo } from "../support/git.js";

// Implementation-independent copy: the ground-truth git must not trust the src list.
const GROUND_TRUTH_SCRUB_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
] as const;

const TEST_IDENTITY = {
  GIT_AUTHOR_NAME: "Sentinel",
  GIT_AUTHOR_EMAIL: "sentinel@otomat.local",
  GIT_COMMITTER_NAME: "Sentinel",
  GIT_COMMITTER_EMAIL: "sentinel@otomat.local",
} as const;

// Ground-truth git that always ignores the ambient hook env, so snapshots of
// the sentinel repo stay trustworthy even while the hook env is active.
function systemGit(cwd: string, ...args: string[]): string {
  const env = { ...process.env, ...TEST_IDENTITY };
  for (const key of GROUND_TRUTH_SCRUB_KEYS) delete env[key];
  return execFileSync("git", args, { cwd, encoding: "utf8", env }).toString();
}

interface RepoSnapshot {
  objects: string;
  refs: string;
}

function snapshot(root: string): RepoSnapshot {
  const objects = systemGit(root, "cat-file", "--batch-all-objects", "--batch-check=%(objectname)")
    .split("\n")
    .toSorted()
    .join("\n");
  const refs = systemGit(root, "for-each-ref", "--format=%(refname) %(objectname)").trim();
  return { objects, refs };
}

function makeRepo(prefix: string, seedFile: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  systemGit(root, "init", "-b", "main");
  systemGit(root, "config", "user.name", "Sentinel");
  systemGit(root, "config", "user.email", "sentinel@otomat.local");
  writeFileSync(join(root, seedFile), `# ${seedFile}\n`);
  systemGit(root, "add", "-A");
  systemGit(root, "commit", "-m", "seed");
  return root;
}

function activateHookEnv(repoRoot: string): () => void {
  const previous = new Map<string, string | undefined>();
  const values: Record<(typeof GIT_ISOLATION_ENV_VARS)[number], string> = {
    GIT_DIR: join(repoRoot, ".git"),
    GIT_WORK_TREE: repoRoot,
    GIT_INDEX_FILE: join(repoRoot, ".git", "index"),
    GIT_COMMON_DIR: join(repoRoot, ".git"),
    GIT_OBJECT_DIRECTORY: join(repoRoot, ".git", "objects"),
  };
  for (const key of GIT_ISOLATION_ENV_VARS) {
    previous.set(key, process.env[key]);
    process.env[key] = values[key];
  }
  return () => {
    for (const key of GIT_ISOLATION_ENV_VARS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe("git env isolation under an ambient hook env", () => {
  it("runGit targets its cwd repo, never the hook's repo", () => {
    const sentinel = makeRepo("otomat-git-sentinel-", "SENTINEL.md");
    const target = makeRepo("otomat-git-target-", "README.md");
    const before = snapshot(sentinel);
    const restore = activateHookEnv(sentinel);
    try {
      writeFileSync(join(target, "feature.txt"), "target work\n");
      runGit(["checkout", "-b", "feature"], { cwd: target });
      runGit(["add", "-A"], { cwd: target });
      runGit(["commit", "-m", "target commit"], { cwd: target });

      expect(systemGit(target, "branch", "--show-current").trim()).toBe("feature");
      expect(systemGit(target, "log", "--oneline").trim()).toContain("target commit");
      expect(snapshot(sentinel)).toEqual(before);
    } finally {
      restore();
      rmSync(sentinel, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("worktreeStateTree writes its throwaway tree into its cwd repo, never the hook's repo", () => {
    const sentinel = makeRepo("otomat-git-sentinel-", "SENTINEL.md");
    const target = makeRepo("otomat-git-target-", "README.md");
    const groundTruth = worktreeStateTree(target, "HEAD");
    const before = snapshot(sentinel);
    const restore = activateHookEnv(sentinel);
    try {
      const tree = worktreeStateTree(target, "HEAD");
      expect(tree).toBe(groundTruth);
      expect(snapshot(sentinel)).toEqual(before);
    } finally {
      restore();
      rmSync(sentinel, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("setupTestRepo fixture builds its own repo, never the hook's repo", () => {
    const sentinel = makeRepo("otomat-git-sentinel-", "SENTINEL.md");
    const before = snapshot(sentinel);
    const restore = activateHookEnv(sentinel);
    try {
      const repo = setupTestRepo();
      try {
        repo.write("added.txt", "fixture work\n");
        repo.commitAll("fixture commit");
        expect(snapshot(sentinel)).toEqual(before);
      } finally {
        repo.cleanup();
      }
    } finally {
      restore();
      rmSync(sentinel, { recursive: true, force: true });
    }
  });
});

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { DbClient } from "@otomat/db";

import type { GitWorktreeService, RepositoryResolver } from "#git";
import { scrubGitEnv } from "#git/git-cli";

import { seedRepository, setupTestDb } from "./db.js";

const TEST_IDENTITY = {
  GIT_AUTHOR_NAME: "Otomat Test",
  GIT_AUTHOR_EMAIL: "test@otomat.local",
  GIT_COMMITTER_NAME: "Otomat Test",
  GIT_COMMITTER_EMAIL: "test@otomat.local",
} as const;

function gitEnv(cwd: string, extraEnv: Record<string, string>, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...scrubGitEnv(process.env), ...TEST_IDENTITY, ...extraEnv },
  }).toString();
}

function git(cwd: string, ...args: string[]): string {
  return gitEnv(cwd, {}, ...args);
}

export interface TestRepo {
  root: string;
  defaultBranch: string;
  write(relPath: string, content: string): void;
  remove(relPath: string): void;
  commitAll(message: string): string;
  /** Commits at an explicit date, so ordering by committer date is observable — real commits land in the same second. */
  commitAllAt(message: string, isoDate: string): string;
  git(...args: string[]): string;
  cleanup(): void;
}

export interface TestRepoOptions {
  /** Skip the bare origin, so a launch has no remote base to fetch. */
  withoutRemote?: boolean;
}

/** A temp git repo on `main` with one initial commit, pushed to a bare origin `main` tracks. */
export function setupTestRepo(options: TestRepoOptions = {}): TestRepo {
  const root = mkdtempSync(join(tmpdir(), "otomat-git-repo-"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Otomat Test");
  git(root, "config", "user.email", "test@otomat.local");
  writeFileSync(join(root, "README.md"), "# base\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "init");

  let remote: string | null = null;
  if (!options.withoutRemote) {
    remote = mkdtempSync(join(tmpdir(), "otomat-git-remote-"));
    git(remote, "init", "--bare", "-b", "main");
    git(root, "remote", "add", "origin", remote);
    git(root, "push", "--quiet", "-u", "origin", "main");
  }

  return {
    root,
    defaultBranch: "main",
    write(relPath, content) {
      const full = join(root, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    remove(relPath) {
      rmSync(join(root, relPath), { force: true });
    },
    commitAll(message) {
      git(root, "add", "-A");
      git(root, "commit", "-m", message);
      return git(root, "rev-parse", "HEAD").trim();
    },
    commitAllAt(message, isoDate) {
      git(root, "add", "-A");
      gitEnv(
        root,
        { GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
        "commit",
        "-m",
        message,
      );
      return git(root, "rev-parse", "HEAD").trim();
    },
    git: (...args) => git(root, ...args),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      if (remote !== null) rmSync(remote, { recursive: true, force: true });
    },
  };
}

/** Every local branch of the repo, so a test can assert which repository a run's branch landed in. */
export function branches(repo: TestRepo): string[] {
  return repo
    .git("branch", "--format=%(refname:short)")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface StubResolverOptions {
  repositoryId?: string;
  /** The real repository root when the test reaches git through the resolver. */
  rootPath?: string;
  worktreesRoot?: string;
}

/** Binds every lookup to one service when a test targets git behavior rather than resolution. */
export function stubRepositoryResolver(
  service: GitWorktreeService,
  options: StubResolverOptions = {},
): RepositoryResolver {
  const binding = {
    repositoryId: options.repositoryId ?? "repo-1",
    service,
    rootPath: options.rootPath ?? "/tmp/otomat-stub-repo",
    defaultBranch: "main",
  };
  return {
    worktreesRoot: options.worktreesRoot ?? "/tmp/otomat-stub-worktrees",
    forRepository: () => binding,
    forProject: () => binding,
    forRun: () => binding,
  };
}

export interface GitTestDb {
  client: DbClient;
  dir: string;
  repositoryId: string;
  cleanup(): void;
}

/** A migrated temp DB with a project + repository row so worktree FKs resolve. */
export function setupGitDb(): GitTestDb {
  const base = setupTestDb("otomat-git-db-");
  return {
    client: base.client,
    dir: base.dir,
    repositoryId: seedRepository(base.db),
    cleanup: base.cleanup,
  };
}

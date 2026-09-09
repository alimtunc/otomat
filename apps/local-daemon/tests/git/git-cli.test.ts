import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitCommandError } from "#git";
import { runGit } from "#git/git-cli";

import { setupTestRepo } from "../support/git.js";

describe("runGit", () => {
  it("returns trimmed stdout and exit code of a successful command", () => {
    const repo = setupTestRepo();
    try {
      const res = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo.root });
      expect(res.stdout.trim()).toBe("main");
      expect(res.exitCode).toBe(0);
    } finally {
      repo.cleanup();
    }
  });

  it("throws GitCommandError carrying stderr on a failing command", () => {
    const repo = setupTestRepo();
    try {
      expect(() => runGit(["rev-parse", "definitely-not-a-ref"], { cwd: repo.root })).toThrow(
        GitCommandError,
      );
    } finally {
      repo.cleanup();
    }
  });

  it("returns the failing result instead of throwing when allowFailure is set", () => {
    const repo = setupTestRepo();
    try {
      const res = runGit(["rev-parse", "--verify", "--quiet", "refs/heads/missing"], {
        cwd: repo.root,
        allowFailure: true,
      });
      expect(res.exitCode).not.toBe(0);
    } finally {
      repo.cleanup();
    }
  });
});

describe("runGit with a timeout", () => {
  let repo: ReturnType<typeof setupTestRepo>;
  let scripts: string;
  let stalling: NodeJS.ProcessEnv;

  beforeEach(() => {
    repo = setupTestRepo();
    scripts = mkdtempSync(join(tmpdir(), "otomat-git-timeout-"));
    const ssh = join(scripts, "stalling-ssh.sh");
    // Detached stdio, so killing git closes its pipes instead of waiting on this child.
    writeFileSync(ssh, "#!/bin/sh\nexec sleep 5 >/dev/null 2>&1 </dev/null\n", { mode: 0o755 });
    stalling = { GIT_SSH_COMMAND: ssh, GIT_TERMINAL_PROMPT: "0" };
  });

  afterEach(() => {
    repo.cleanup();
    rmSync(scripts, { recursive: true, force: true });
  });

  it("reports a peer that never answers as a failure with no exit code", () => {
    const res = runGit(["ls-remote", "ssh://unreachable.invalid/repo.git"], {
      cwd: repo.root,
      env: stalling,
      allowFailure: true,
      timeoutMs: 300,
    });

    expect(res.exitCode).toBeNull();
    expect(res.stderr).toBe("timed out after 300ms");
  });

  it("throws the module's own error, not a bare errno, when failure is not allowed", () => {
    expect(() =>
      runGit(["ls-remote", "ssh://unreachable.invalid/repo.git"], {
        cwd: repo.root,
        env: stalling,
        timeoutMs: 300,
      }),
    ).toThrow(GitCommandError);
  });
});

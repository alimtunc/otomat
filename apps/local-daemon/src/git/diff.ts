import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseNameStatusZ, parseNumstatZ, splitPatchByFile } from "./diff-parse.js";
import { runGit } from "./git-cli.js";
import type {
  CanonicalDiff,
  ChangedFile,
  DiffFile,
  DiffFileBlobs,
  DiffFilePaths,
} from "./types.js";

const QUOTEPATH_OFF = ["-c", "core.quotepath=false"];

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Writes a tree object capturing the worktree's full state (committed +
 * staged + unstaged + untracked, minus gitignored) relative to `baseRef`,
 * using a throwaway index so the worktree's real index is untouched.
 */
export function worktreeStateTree(gitCwd: string, baseRef: string): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-git-index-"));
  const env = { GIT_INDEX_FILE: join(dir, "index") };
  try {
    runGit(["read-tree", baseRef], { cwd: gitCwd, env });
    runGit(["add", "-A"], { cwd: gitCwd, env });
    return runGit(["write-tree"], { cwd: gitCwd, env }).stdout.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Structured per-file change list for `base..tree`, computed from git. */
export function collectChangedFiles(gitCwd: string, base: string, tree: string): ChangedFile[] {
  const nameStatus = runGit(
    [...QUOTEPATH_OFF, "diff", "--no-color", "--find-renames", "--name-status", "-z", base, tree],
    { cwd: gitCwd },
  ).stdout;
  const numstat = runGit(
    [...QUOTEPATH_OFF, "diff", "--no-color", "--find-renames", "--numstat", "-z", base, tree],
    { cwd: gitCwd },
  ).stdout;

  const counts = parseNumstatZ(numstat);
  return parseNameStatusZ(nameStatus).map((entry) => {
    const count = counts.get(entry.path);
    return {
      path: entry.path,
      oldPath: entry.oldPath,
      status: entry.status,
      additions: count?.additions ?? 0,
      deletions: count?.deletions ?? 0,
      binary: count?.binary ?? false,
    };
  });
}

/** Canonical diff of `base..tree`: per-file patches, counts, and stable shas. */
export function computeCanonicalDiff(gitCwd: string, base: string, tree: string): CanonicalDiff {
  const changed = collectChangedFiles(gitCwd, base, tree);
  const patch = runGit([...QUOTEPATH_OFF, "diff", "--no-color", "--find-renames", base, tree], {
    cwd: gitCwd,
  }).stdout;
  const sections = splitPatchByFile(patch);

  const files: DiffFile[] = changed.map((file) => {
    const text = sections.get(file.path) ?? "";
    return { ...file, patch: text, sha: sha256(text) };
  });

  return {
    base,
    files,
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    sha: sha256(patch),
  };
}

function readBlob(gitCwd: string, ref: string, path: string): string | null {
  const result = runGit(["show", `${ref}:${path}`], { cwd: gitCwd, allowFailure: true });
  return result.exitCode === 0 ? result.stdout : null;
}

export function readFileBlobs(
  gitCwd: string,
  base: string,
  tree: string,
  paths: DiffFilePaths,
): DiffFileBlobs {
  return {
    base: readBlob(gitCwd, base, paths.oldPath ?? paths.path),
    head: readBlob(gitCwd, tree, paths.path),
  };
}

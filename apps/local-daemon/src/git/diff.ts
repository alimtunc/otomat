import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DiffFileContract } from "@otomat/domain";

import { parseNameStatusZ, parseNumstatZ, splitPatchByFile } from "./diff-parse.js";
import { runGit, runGitBytes } from "./git-cli.js";
import type { DiffSnapshot } from "./service-contract.js";
import { readTreeFile } from "./tree-file.js";
import type {
  CanonicalDiff,
  ChangedFile,
  DiffFile,
  DiffFileBlobs,
  DiffFileMediaBlobs,
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
export async function worktreeStateTree(gitCwd: string, baseRef: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "otomat-git-index-"));
  const env = { GIT_INDEX_FILE: join(dir, "index") };
  try {
    await runGit(["read-tree", baseRef], { cwd: gitCwd, env });
    await runGit(["add", "-A"], { cwd: gitCwd, env });
    return (await runGit(["write-tree"], { cwd: gitCwd, env })).stdout.trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Structured per-file change list for `base..tree`, computed from git. */
export async function collectChangedFiles(
  gitCwd: string,
  base: string,
  tree: string,
): Promise<ChangedFile[]> {
  const listing = (format: string) =>
    runGit([...QUOTEPATH_OFF, "diff", "--no-color", "--find-renames", format, "-z", base, tree], {
      cwd: gitCwd,
    });
  const [nameStatus, numstat] = await Promise.all([listing("--name-status"), listing("--numstat")]);

  const counts = parseNumstatZ(numstat.stdout);
  return parseNameStatusZ(nameStatus.stdout).map((entry) => {
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

export function toDiffFileContract(file: DiffFile): DiffFileContract {
  const { oldPath, ...rest } = file;
  return { ...rest, old_path: oldPath };
}

/** Canonical diff of `base..tree`: per-file patches, counts, and stable shas. */
export async function computeCanonicalDiff(
  gitCwd: string,
  base: string,
  tree: string,
): Promise<CanonicalDiff> {
  const [changed, diff] = await Promise.all([
    collectChangedFiles(gitCwd, base, tree),
    runGit([...QUOTEPATH_OFF, "diff", "--no-color", "--find-renames", base, tree], {
      cwd: gitCwd,
    }),
  ]);
  const patch = diff.stdout;
  const sections = splitPatchByFile(patch);

  const files: DiffFile[] = changed.map((file) => {
    const text = sections.get(file.path) ?? "";
    return { ...file, patch: text, sha: sha256(text) };
  });

  return {
    base,
    head: tree,
    files,
    additions: files.reduce((sum, f) => sum + f.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    sha: sha256(patch),
  };
}

async function readBlob(gitCwd: string, ref: string, path: string): Promise<string | null> {
  const result = await runGit(["show", `${ref}:${path}`], { cwd: gitCwd, allowFailure: true });
  return result.exitCode === 0 ? result.stdout : null;
}

export async function readFileBlobs(
  gitCwd: string,
  base: string,
  tree: string,
  paths: DiffFilePaths,
): Promise<DiffFileBlobs> {
  return {
    base: await readBlob(gitCwd, base, paths.oldPath ?? paths.path),
    head: await readBlob(gitCwd, tree, paths.path),
  };
}

async function readMediaBlob(gitCwd: string, ref: string, path: string): Promise<Buffer | null> {
  const result = await runGitBytes(["show", `${ref}:${path}`], {
    cwd: gitCwd,
    allowFailure: true,
  });
  return result.exitCode === 0 ? result.stdout : null;
}

async function readMediaBlobs(
  gitCwd: string,
  base: string,
  tree: string,
  paths: DiffFilePaths,
): Promise<DiffFileMediaBlobs> {
  return {
    base: await readMediaBlob(gitCwd, base, paths.oldPath ?? paths.path),
    head: await readMediaBlob(gitCwd, tree, paths.path),
  };
}

export async function treeRangeSnapshot(
  gitCwd: string,
  base: string,
  tree: string,
): Promise<DiffSnapshot> {
  return {
    diff: await computeCanonicalDiff(gitCwd, base, tree),
    fileBlobs: (paths) => readFileBlobs(gitCwd, base, tree, paths),
    mediaBlobs: (paths) => readMediaBlobs(gitCwd, base, tree, paths),
    readFile: (path, limits) => readTreeFile(gitCwd, tree, path, limits),
  };
}

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runGit } from "./git-cli.js";
import type { CanonicalDiff, ChangedFile, ChangeStatus, DiffFile } from "./types.js";

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
  const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
  try {
    runGit(["read-tree", baseRef], { cwd: gitCwd, env });
    runGit(["add", "-A"], { cwd: gitCwd, env });
    return runGit(["write-tree"], { cwd: gitCwd, env }).stdout.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function mapStatusCode(code: string): ChangeStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    default:
      return "modified";
  }
}

interface StatusEntry {
  path: string;
  oldPath: string | null;
  status: ChangeStatus;
}

function parseNameStatusZ(out: string): StatusEntry[] {
  const fields = out.split("\0");
  const entries: StatusEntry[] = [];
  let i = 0;
  while (i < fields.length) {
    const code = fields[i++];
    if (code === "" || code === undefined) continue;
    if (code[0] === "R" || code[0] === "C") {
      const oldPath = fields[i++] ?? "";
      const path = fields[i++] ?? "";
      entries.push({ path, oldPath, status: mapStatusCode(code) });
    } else {
      const path = fields[i++] ?? "";
      entries.push({ path, oldPath: null, status: mapStatusCode(code) });
    }
  }
  return entries;
}

interface CountEntry {
  additions: number;
  deletions: number;
  binary: boolean;
}

function parseNumstatZ(out: string): Map<string, CountEntry> {
  const tokens = out.split("\0");
  const counts = new Map<string, CountEntry>();
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i++];
    if (tok === "" || tok === undefined) continue;
    const firstTab = tok.indexOf("\t");
    if (firstTab === -1) continue;
    const secondTab = tok.indexOf("\t", firstTab + 1);
    const addStr = tok.slice(0, firstTab);
    const delStr = tok.slice(firstTab + 1, secondTab);
    const pathPart = tok.slice(secondTab + 1);
    let path = pathPart;
    if (pathPart === "") {
      i++; // skip the rename source; counts key on the destination path
      path = tokens[i++] ?? "";
    }
    const binary = addStr === "-" || delStr === "-";
    counts.set(path, {
      additions: binary ? 0 : Number.parseInt(addStr, 10),
      deletions: binary ? 0 : Number.parseInt(delStr, 10),
      binary,
    });
  }
  return counts;
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

// git appends a literal TAB separator to `+++ b/<path>` / `--- a/<path>` lines
// when the path contains whitespace; an unquoted path never contains a TAB.
function stripPathTrailer(path: string): string {
  const tab = path.indexOf("\t");
  return tab === -1 ? path : path.slice(0, tab);
}

function patchSectionPath(body: string[]): string | null {
  let renameTo: string | null = null;
  let plusPath: string | null = null;
  let minusPath: string | null = null;
  for (const line of body) {
    if (line.startsWith("rename to ")) renameTo = line.slice("rename to ".length);
    else if (line.startsWith("+++ b/")) plusPath = stripPathTrailer(line.slice(6));
    else if (line.startsWith("--- a/")) minusPath = stripPathTrailer(line.slice(6));
  }
  if (renameTo) return renameTo;
  if (plusPath) return plusPath;
  if (minusPath) return minusPath;
  const header = /^diff --git a\/(.*) b\/(.*)$/.exec(body[0] ?? "");
  return header ? header[2] : null;
}

function splitPatchByFile(patch: string): Map<string, string> {
  const sections = new Map<string, string>();
  let body: string[] = [];
  const flush = () => {
    if (body.length === 0) return;
    const path = patchSectionPath(body);
    if (path) sections.set(path, body.join("\n"));
    body = [];
  };
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      body = [line];
    } else if (body.length > 0) {
      body.push(line);
    }
  }
  flush();
  return sections;
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

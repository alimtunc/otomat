import { unlinkSync } from "node:fs";
import { join } from "node:path";

import {
  changeSupportsSelection,
  type ChangeFilesRequest,
  type ChangeSelection,
  type DiffFileContract,
  type SourceControlAction,
} from "@otomat/domain";

import { runGit } from "../git-cli.js";
import { lsTree } from "../tree-file.js";
import { SourceControlError } from "./errors.js";
import { assertChangePath } from "./paths.js";
import { selectedPatch } from "./selection.js";
import { sourceControlSnapshot, type CheckoutSnapshot } from "./snapshot.js";

function changePaths(files: DiffFileContract[]): string[] {
  return [
    ...new Set(
      files.flatMap((entry) =>
        entry.old_path === null ? [entry.path] : [entry.old_path, entry.path],
      ),
    ),
  ];
}

function assertFileChanges(
  cwd: string,
  snapshot: Extract<CheckoutSnapshot, { conflicted: false }>,
  paths: string[],
): void {
  for (const path of paths) {
    assertChangePath(cwd, path);
    for (const tree of [snapshot.head, snapshot.index, snapshot.tree]) {
      const entry = lsTree(cwd, tree, path);
      if (entry !== null && entry.type !== "blob")
        throw new SourceControlError(
          "change_unavailable",
          "Open submodule and directory changes in an external Git client.",
        );
    }
  }
}

function applySelection(
  cwd: string,
  file: DiffFileContract,
  action: SourceControlAction,
  selection: ChangeSelection,
): void {
  if (!changeSupportsSelection(file))
    throw new SourceControlError(
      "selection_unavailable",
      "Stage, unstage or discard this change as a whole file.",
    );
  const reverse = action !== "stage";
  const patch = selectedPatch(file.patch, selection, reverse);
  const args = [
    "apply",
    "--recount",
    ...(reverse ? ["--reverse"] : []),
    ...(action === "discard" ? [] : ["--cached"]),
  ];
  const check = runGit([...args, "--check"], { cwd, input: patch, allowFailure: true });
  if (check.exitCode !== 0)
    throw new SourceControlError(
      "selection_unavailable",
      "This selection no longer applies cleanly. Refresh or select the whole change block.",
    );
  runGit(args, { cwd, input: patch });
}

function discardPaths(cwd: string, index: string, paths: string[]): void {
  // A failed lookup must throw here: an untracked verdict deletes the file from disk.
  const tracked = paths.filter(
    (path) =>
      runGit(["--literal-pathspecs", "ls-tree", "-z", index, "--", path], { cwd }).stdout !== "",
  );
  for (const path of paths.filter((candidate) => !tracked.includes(candidate)))
    unlinkSync(join(cwd, path));
  if (tracked.length > 0)
    runGit(
      ["--literal-pathspecs", "restore", "--worktree", `--source=${index}`, "--", ...tracked],
      { cwd },
    );
}

export function changeCheckoutFiles(cwd: string, request: ChangeFilesRequest): void {
  if (request.path !== undefined) assertChangePath(cwd, request.path);
  const snapshot = sourceControlSnapshot(cwd);
  if (snapshot.conflicted)
    throw new SourceControlError(
      "checkout_conflicted",
      "Resolve merge conflicts before changing the staging area.",
    );
  if (snapshot.response.revision !== request.revision)
    throw new SourceControlError(
      "checkout_stale",
      "The checkout changed. Refresh and review the latest changes before trying again.",
    );
  const entries =
    request.action === "unstage" ? snapshot.response.staged : snapshot.response.unstaged;
  const files = request.all ? entries : entries.filter((entry) => entry.path === request.path);
  const file = files[0];
  if (file === undefined)
    throw new SourceControlError(
      "change_unavailable",
      "This file has no change in the selected section.",
    );
  const paths = changePaths(files);
  assertFileChanges(cwd, snapshot, paths);
  if (request.selection !== undefined) {
    applySelection(cwd, file, request.action, request.selection);
  } else if (request.action === "stage") {
    runGit(["--literal-pathspecs", "add", "-A", "--", ...paths], { cwd });
  } else if (request.action === "unstage") {
    runGit(
      ["--literal-pathspecs", "restore", "--staged", `--source=${snapshot.head}`, "--", ...paths],
      { cwd },
    );
  } else {
    discardPaths(cwd, snapshot.index, paths);
  }
}

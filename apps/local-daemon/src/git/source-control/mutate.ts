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
import { inCheckout } from "../lock.js";
import { lsTree } from "../tree-file.js";
import { SourceControlError } from "./errors.js";
import { assertChangePath } from "./paths.js";
import { selectedPatch } from "./selection.js";
import { readCheckoutSnapshot, type CheckoutSnapshot } from "./snapshot.js";

function changePaths(files: DiffFileContract[]): string[] {
  return [
    ...new Set(
      files.flatMap((entry) =>
        entry.old_path === null ? [entry.path] : [entry.old_path, entry.path],
      ),
    ),
  ];
}

async function assertFileChanges(
  cwd: string,
  snapshot: Extract<CheckoutSnapshot, { conflicted: false }>,
  paths: string[],
): Promise<void> {
  for (const path of paths) {
    assertChangePath(cwd, path);
    for (const tree of [snapshot.head, snapshot.index, snapshot.tree]) {
      const entry = await lsTree(cwd, tree, path);
      if (entry !== null && entry.type !== "blob")
        throw new SourceControlError(
          "change_unavailable",
          "Open submodule and directory changes in an external Git client.",
        );
    }
  }
}

async function applySelection(
  cwd: string,
  file: DiffFileContract,
  action: SourceControlAction,
  selection: ChangeSelection,
): Promise<void> {
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
  const check = await runGit([...args, "--check"], { cwd, input: patch, allowFailure: true });
  if (check.exitCode !== 0)
    throw new SourceControlError(
      "selection_unavailable",
      "This selection no longer applies cleanly. Refresh or select the whole change block.",
    );
  await runGit(args, { cwd, input: patch });
}

async function discardPaths(cwd: string, index: string, paths: string[]): Promise<void> {
  const tracked: string[] = [];
  for (const path of paths) {
    // A failed lookup must throw here: an untracked verdict deletes the file from disk.
    const listed = await runGit(["--literal-pathspecs", "ls-tree", "-z", index, "--", path], {
      cwd,
    });
    if (listed.stdout !== "") tracked.push(path);
  }
  for (const path of paths.filter((candidate) => !tracked.includes(candidate)))
    unlinkSync(join(cwd, path));
  if (tracked.length > 0)
    await runGit(
      ["--literal-pathspecs", "restore", "--worktree", `--source=${index}`, "--", ...tracked],
      { cwd },
    );
}

export function changeCheckoutFiles(cwd: string, request: ChangeFilesRequest): Promise<void> {
  return inCheckout(cwd, () => applyChange(cwd, request));
}

async function applyChange(cwd: string, request: ChangeFilesRequest): Promise<void> {
  if (request.path !== undefined) assertChangePath(cwd, request.path);
  const snapshot = await readCheckoutSnapshot(cwd);
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
  await assertFileChanges(cwd, snapshot, paths);
  if (request.selection !== undefined) {
    await applySelection(cwd, file, request.action, request.selection);
  } else if (request.action === "stage") {
    await runGit(["--literal-pathspecs", "add", "-A", "--", ...paths], { cwd });
  } else if (request.action === "unstage") {
    await runGit(
      ["--literal-pathspecs", "restore", "--staged", `--source=${snapshot.head}`, "--", ...paths],
      { cwd },
    );
  } else {
    await discardPaths(cwd, snapshot.index, paths);
  }
}

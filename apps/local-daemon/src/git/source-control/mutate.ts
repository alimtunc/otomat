import { unlinkSync } from "node:fs";
import { join } from "node:path";

import type { ChangeFilesRequest } from "@otomat/domain";

import { runGit } from "../git-cli.js";
import { SourceControlError } from "./errors.js";
import { assertChangePath } from "./paths.js";
import { selectedPatch } from "./selection.js";
import { sourceControlSnapshot } from "./snapshot.js";

export function changeCheckoutFiles(cwd: string, request: ChangeFilesRequest): void {
  if (request.path !== undefined) assertChangePath(cwd, request.path);
  const snapshot = sourceControlSnapshot(cwd);
  if (snapshot.response.conflicts.length > 0)
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
  const paths = [
    ...new Set(
      files.flatMap((entry) =>
        entry.old_path === null ? [entry.path] : [entry.old_path, entry.path],
      ),
    ),
  ];
  for (const path of paths) {
    assertChangePath(cwd, path);
    for (const tree of [snapshot.head, snapshot.index, snapshot.tree]) {
      const metadata = runGit(["--literal-pathspecs", "ls-tree", tree, "--", path], { cwd }).stdout;
      if (metadata.startsWith("160000") || metadata.startsWith("040000"))
        throw new SourceControlError(
          "change_unavailable",
          "Open submodule and directory changes in an external Git client.",
        );
    }
  }

  if (request.selection !== undefined) {
    if (file.binary || file.old_path !== null || file.status !== "modified")
      throw new SourceControlError(
        "selection_unavailable",
        "Stage, unstage or discard this change as a whole file.",
      );
    const reverse = request.action !== "stage";
    const patch = selectedPatch(file.patch, request.selection, reverse);
    const args = [
      "apply",
      "--recount",
      ...(reverse ? ["--reverse"] : []),
      ...(request.action === "discard" ? [] : ["--cached"]),
    ];
    const check = runGit([...args, "--check"], { cwd, input: patch, allowFailure: true });
    if (check.exitCode !== 0)
      throw new SourceControlError(
        "selection_unavailable",
        "This selection no longer applies cleanly. Refresh or select the whole change block.",
      );
    runGit(args, { cwd, input: patch });
  } else if (request.action === "stage") {
    runGit(["--literal-pathspecs", "add", "-A", "--", ...paths], { cwd });
  } else if (request.action === "unstage") {
    runGit(
      ["--literal-pathspecs", "restore", "--staged", `--source=${snapshot.head}`, "--", ...paths],
      { cwd },
    );
  } else {
    const tracked = paths.filter(
      (path) =>
        runGit(["--literal-pathspecs", "ls-tree", "-z", snapshot.index, "--", path], { cwd })
          .stdout !== "",
    );
    for (const path of paths.filter((candidate) => !tracked.includes(candidate)))
      unlinkSync(join(cwd, path));
    if (tracked.length > 0)
      runGit(
        [
          "--literal-pathspecs",
          "restore",
          "--worktree",
          `--source=${snapshot.index}`,
          "--",
          ...tracked,
        ],
        { cwd },
      );
  }
}

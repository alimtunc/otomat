import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { ChangeFilesRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { changeCheckoutFiles, sourceControlSnapshot } from "#git";
import { runGit } from "#git/git-cli";
import { snapshotWorktree } from "#git/worktree-snapshot";
import { setupTestRepo, type TestRepo } from "#test-support/git";

let repo: TestRepo;
const initial = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelve\n";

beforeEach(() => {
  repo = setupTestRepo();
  repo.write("notes.txt", initial);
  repo.commitAll("seed");
});

afterEach(() => repo.cleanup());

function change(request: Omit<ChangeFilesRequest, "revision">): void {
  changeCheckoutFiles(repo.root, {
    revision: sourceControlSnapshot(repo.root).response.revision,
    ...request,
  });
}

function indexText(path = "notes.txt"): string {
  return runGit(["show", `:${path}`], { cwd: repo.root }).stdout;
}

it("keeps staged and unstaged versions separate, including after discard and unstage", () => {
  repo.write("notes.txt", "staged\n");
  change({ action: "stage", path: "notes.txt" });
  repo.write("notes.txt", "unstaged\n");
  const before = sourceControlSnapshot(repo.root).response;
  expect(before.staged[0]?.patch).toContain("+staged");
  expect(before.unstaged[0]?.patch).toContain("-staged\n+unstaged");
  expect(indexText()).toBe("staged\n");
  change({ action: "discard", path: "notes.txt" });
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe("staged\n");
  expect(sourceControlSnapshot(repo.root).response.unstaged).toEqual([]);
  change({ action: "unstage", path: "notes.txt" });
  expect(indexText()).toBe(initial);
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe("staged\n");
});

it("stages one hunk, unstages it, and discards another without touching the index", () => {
  const edited = initial.replace("one", "ONE").replace("twelve", "TWELVE");
  repo.write("notes.txt", edited);
  change({ action: "stage", path: "notes.txt", selection: { kind: "hunk", index: 0 } });
  expect(indexText()).toBe(initial.replace("one", "ONE"));
  change({ action: "discard", path: "notes.txt", selection: { kind: "hunk", index: 0 } });
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe(indexText());
  change({ action: "unstage", path: "notes.txt", selection: { kind: "hunk", index: 0 } });
  expect(indexText()).toBe(initial);
});

it("stages selected added lines while leaving neighboring changes on disk", () => {
  repo.write("notes.txt", initial.replace("two\n", "two\nnew A\nnew B\n"));
  change({
    action: "stage",
    path: "notes.txt",
    selection: { kind: "lines", side: "new", start: 3, end: 3 },
  });
  expect(indexText()).toBe(initial.replace("two\n", "two\nnew A\n"));
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toContain("new B");
  change({
    action: "unstage",
    path: "notes.txt",
    selection: { kind: "lines", side: "new", start: 3, end: 3 },
  });
  expect(indexText()).toBe(initial);
  change({
    action: "discard",
    path: "notes.txt",
    selection: { kind: "lines", side: "new", start: 4, end: 4 },
  });
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe(
    initial.replace("two\n", "two\nnew A\n"),
  );
});

it("handles deleted-line selections", () => {
  repo.write("notes.txt", initial.replace("two\nthree\n", ""));
  change({
    action: "stage",
    path: "notes.txt",
    selection: { kind: "lines", side: "old", start: 2, end: 2 },
  });
  expect(indexText()).toBe(initial.replace("two\n", ""));
  change({
    action: "discard",
    path: "notes.txt",
    selection: { kind: "lines", side: "old", start: 2, end: 2 },
  });
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe(indexText());
});

it("keeps missing final newlines and leaves executable mode out of partial staging", () => {
  repo.write("notes.txt", "first\nlast");
  repo.commitAll("no trailing newline");
  repo.write("notes.txt", "first\nLAST");
  chmodSync(join(repo.root, "notes.txt"), 0o755);
  change({ action: "stage", path: "notes.txt", selection: { kind: "hunk", index: 0 } });
  expect(indexText()).toBe("first\nLAST");
  expect(repo.git("ls-files", "--stage", "notes.txt")).toMatch(/^100644 /);
  change({ action: "unstage", path: "notes.txt", selection: { kind: "hunk", index: 0 } });
  expect(indexText()).toBe("first\nlast");
});

it("discards a rename by restoring the source and removing only its destination", () => {
  renameSync(join(repo.root, "notes.txt"), join(repo.root, "renamed.txt"));
  repo.write("keep.txt", "keep\n");
  expect(
    sourceControlSnapshot(repo.root).response.unstaged.find((file) => file.path === "renamed.txt")
      ?.old_path,
  ).toBe("notes.txt");
  change({ action: "discard", path: "renamed.txt" });
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe(initial);
  expect(existsSync(join(repo.root, "renamed.txt"))).toBe(false);
  expect(readFileSync(join(repo.root, "keep.txt"), "utf8")).toBe("keep\n");
});

it("refuses stale changes before touching either the file or index", () => {
  repo.write("notes.txt", "mine\n");
  const revision = sourceControlSnapshot(repo.root).response.revision;
  repo.write("notes.txt", "agent\n");
  expect(() =>
    changeCheckoutFiles(repo.root, { revision, action: "discard", path: "notes.txt" }),
  ).toThrow("checkout changed");
  expect(indexText()).toBe(initial);
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe("agent\n");
});

it("treats pathspec characters literally and discards only the selected untracked file", () => {
  repo.write("[a].txt", "selected\n");
  repo.write("a.txt", "keep\n");
  change({ action: "stage", path: "[a].txt" });
  expect(sourceControlSnapshot(repo.root).response.staged.map((file) => file.path)).toEqual([
    "[a].txt",
  ]);
  change({ action: "unstage", path: "[a].txt" });
  change({ action: "discard", path: "[a].txt" });
  expect(readFileSync(join(repo.root, "a.txt"), "utf8")).toBe("keep\n");
});

it("keeps force-added ignored files in the working snapshot", () => {
  repo.write(".gitignore", "ignored.txt\n");
  repo.commitAll("ignore a file");
  repo.write("ignored.txt", "staged\n");
  repo.git("add", "--force", "ignored.txt");
  expect(sourceControlSnapshot(repo.root).response.unstaged).toEqual([]);
  repo.write("ignored.txt", "working\n");
  change({ action: "discard", path: "ignored.txt" });
  expect(readFileSync(join(repo.root, "ignored.txt"), "utf8")).toBe("staged\n");
});

it("rejects traversal and symlinked parents", () => {
  symlinkSync(repo.root, join(repo.root, "linked"));
  for (const path of ["../host", ".git/config", "linked/notes.txt"]) {
    expect(() => change({ action: "discard", path })).toThrow();
  }
  expect(indexText()).toBe(initial);
});

it("reports unresolved merges and refuses staging them", () => {
  const oid = runGit(["rev-parse", "HEAD:notes.txt"], { cwd: repo.root }).stdout.trim();
  runGit(["update-index", "--index-info"], {
    cwd: repo.root,
    input: `0 ${"0".repeat(40)}\tnotes.txt\n100644 ${oid} 1\tnotes.txt\n100644 ${oid} 2\tnotes.txt\n100644 ${oid} 3\tnotes.txt\n`,
  });
  writeFileSync(join(repo.root, "notes.txt"), "conflict\n");
  expect(sourceControlSnapshot(repo.root).response.conflicts).toEqual(["notes.txt"]);
  expect(() => change({ action: "stage", path: "notes.txt" })).toThrow("Resolve merge conflicts");
});

it("never lets an automatic snapshot overwrite a partial staging selection", () => {
  repo.write("notes.txt", "staged\n");
  change({ action: "stage", path: "notes.txt" });
  repo.write("notes.txt", "unstaged\n");
  const head = repo.git("rev-parse", "HEAD");
  expect(() => snapshotWorktree(repo.root, "snapshot")).toThrow("staged and unstaged");
  expect(repo.git("rev-parse", "HEAD")).toBe(head);
  expect(indexText()).toBe("staged\n");
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe("unstaged\n");
});

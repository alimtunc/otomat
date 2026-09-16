import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { changeCheckoutFiles, sourceControlSnapshot } from "#git";
import { snapshotWorktree } from "#git/worktree-snapshot";
import { setupTestRepo, type TestRepo } from "#test-support/git";

let repo: TestRepo;

beforeEach(() => {
  repo = setupTestRepo();
});

afterEach(() => repo.cleanup());

it("never lets an automatic snapshot overwrite a partial staging selection", () => {
  repo.write("notes.txt", "staged\n");
  changeCheckoutFiles(repo.root, {
    action: "stage",
    path: "notes.txt",
    revision: sourceControlSnapshot(repo.root).response.revision,
  });
  repo.write("notes.txt", "unstaged\n");
  const head = repo.git("rev-parse", "HEAD");
  expect(() => snapshotWorktree(repo.root, "snapshot")).toThrow("staged and unstaged");
  expect(repo.git("rev-parse", "HEAD")).toBe(head);
  expect(repo.git("show", ":notes.txt")).toBe("staged\n");
  expect(readFileSync(join(repo.root, "notes.txt"), "utf8")).toBe("unstaged\n");
});

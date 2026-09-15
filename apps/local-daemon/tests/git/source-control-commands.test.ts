import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { changeFilesRequestSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { changeCheckoutFiles, commitCheckoutFiles, sourceControlSnapshot } from "#git";
import { setupTestRepo, type TestRepo } from "#test-support/git";

let repo: TestRepo;
beforeEach(() => {
  repo = setupTestRepo();
});
afterEach(() => repo.cleanup());

it("stages and unstages all changes without changing their content", () => {
  repo.write("README.md", "edited\n");
  repo.write("new.txt", "new\n");
  changeCheckoutFiles(repo.root, {
    action: "stage",
    all: true,
    revision: sourceControlSnapshot(repo.root).response.revision,
  });
  expect(sourceControlSnapshot(repo.root).response.staged).toHaveLength(2);
  changeCheckoutFiles(repo.root, {
    action: "unstage",
    all: true,
    revision: sourceControlSnapshot(repo.root).response.revision,
  });
  const after = sourceControlSnapshot(repo.root).response;
  expect(after.staged).toEqual([]);
  expect(after.unstaged).toHaveLength(2);
  expect(readFileSync(join(repo.root, "README.md"), "utf8")).toBe("edited\n");
});

it("discards all unstaged changes while preserving staged changes and ignored files", () => {
  repo.write(".gitignore", "ignored.txt\n");
  repo.commitAll("ignore");
  repo.write("README.md", "staged\n");
  repo.git("add", "README.md");
  repo.write("README.md", "unstaged\n");
  repo.write("new.txt", "untracked\n");
  repo.write("ignored.txt", "keep\n");
  changeCheckoutFiles(repo.root, {
    action: "discard",
    all: true,
    revision: sourceControlSnapshot(repo.root).response.revision,
  });
  expect(readFileSync(join(repo.root, "README.md"), "utf8")).toBe("staged\n");
  expect(existsSync(join(repo.root, "new.txt"))).toBe(false);
  expect(readFileSync(join(repo.root, "ignored.txt"), "utf8")).toBe("keep\n");
  expect(sourceControlSnapshot(repo.root).response.staged).toHaveLength(1);
  expect(sourceControlSnapshot(repo.root).response.unstaged).toEqual([]);
});

it("rejects stale bulk operations and ambiguous requests", () => {
  repo.write("README.md", "reviewed\n");
  const revision = sourceControlSnapshot(repo.root).response.revision;
  repo.write("new.txt", "written after confirmation\n");
  expect(() => changeCheckoutFiles(repo.root, { action: "discard", all: true, revision })).toThrow(
    "checkout changed",
  );
  expect(existsSync(join(repo.root, "new.txt"))).toBe(true);
  expect(changeFilesRequestSchema.safeParse({ action: "discard", revision }).success).toBe(false);
  expect(
    changeFilesRequestSchema.safeParse({
      action: "discard",
      revision,
      all: true,
      path: "README.md",
    }).success,
  ).toBe(false);
  expect(
    changeFilesRequestSchema.safeParse({
      action: "discard",
      revision,
      all: true,
      selection: { kind: "hunk", index: 0 },
    }).success,
  ).toBe(false);
});

it("commits only the index, preserving identity, unstaged edits and untracked files", () => {
  repo.write("README.md", "staged\n");
  repo.git("add", "README.md");
  repo.write("README.md", "unstaged\n");
  repo.write("new.txt", "untracked\n");
  const result = commitCheckoutFiles(repo.root, {
    revision: sourceControlSnapshot(repo.root).response.revision,
    message: "feat: manual edit",
  });
  expect(result.sha).toBe(repo.git("rev-parse", "HEAD").trim());
  expect(repo.git("show", "HEAD:README.md")).toBe("staged\n");
  expect(repo.git("log", "-1", "--format=%an <%ae>").trim()).toBe(
    "Otomat Test <test@otomat.local>",
  );
  expect(readFileSync(join(repo.root, "README.md"), "utf8")).toBe("unstaged\n");
  expect(sourceControlSnapshot(repo.root).response.unstaged).toHaveLength(2);
  expect(() =>
    commitCheckoutFiles(repo.root, {
      revision: sourceControlSnapshot(repo.root).response.revision,
      message: "empty",
    }),
  ).toThrow("Stage changes");
});

it("refuses a stale commit and respects a failing commit hook", () => {
  repo.write("README.md", "staged\n");
  repo.git("add", "README.md");
  const revision = sourceControlSnapshot(repo.root).response.revision;
  repo.git("switch", "-c", "another-branch");
  expect(() => commitCheckoutFiles(repo.root, { revision, message: "stale" })).toThrow(
    "checkout changed",
  );
  repo.write(".git/hooks/pre-commit", "#!/bin/sh\necho rejected-by-hook >&2\nexit 1\n");
  chmodSync(join(repo.root, ".git/hooks/pre-commit"), 0o755);
  const head = repo.git("rev-parse", "HEAD");
  expect(() =>
    commitCheckoutFiles(repo.root, {
      revision: sourceControlSnapshot(repo.root).response.revision,
      message: "blocked",
    }),
  ).toThrow("rejected-by-hook");
  expect(repo.git("rev-parse", "HEAD")).toBe(head);
  expect(sourceControlSnapshot(repo.root).response.staged).toHaveLength(1);
});

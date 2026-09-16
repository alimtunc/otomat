import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { commitCheckoutFiles, sourceControlSnapshot } from "#git";
import { setupTestRepo, type TestRepo } from "#test-support/git";

let repo: TestRepo;
beforeEach(() => {
  repo = setupTestRepo();
});
afterEach(() => repo.cleanup());

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

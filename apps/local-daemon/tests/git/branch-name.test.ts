import { afterEach, expect, it } from "vitest";

import { availableBranchName, sanitizeBranchName } from "#git";
import { setupTestRepo, type TestRepo } from "#test-support/git";

let repo: TestRepo | undefined;
afterEach(() => repo?.cleanup());

it.each([
  ["Feat/Add Note!", "feat/add-note"],
  ["  fix: crash on boot  ", "fix-crash-on-boot"],
  ["feat//double--dash-", "feat/double-dash"],
  ["feat/Coordonnées de l’interlocuteur", "feat/coordonnees-de-l-interlocuteur"],
  ["otomat/run/abc", null],
  ["???", null],
])("normalizes %j to %j", (raw, expected) => {
  expect(sanitizeBranchName(raw)).toBe(expected);
});

it("keeps a free name and avoids local, tracked remote and nested branch collisions", () => {
  repo = setupTestRepo();
  expect(availableBranchName(repo.root, "feat/export", "12345678")).toBe("feat/export");
  for (const ref of [
    "refs/heads/feat/local",
    "refs/remotes/origin/feat/remote",
    "refs/heads/feat/nested/child",
  ])
    repo.git("update-ref", ref, "HEAD");
  for (const name of ["local", "remote", "nested"]) {
    expect(availableBranchName(repo.root, `feat/${name}`, "12345678")).toBe(
      `feat/${name}-12345678`,
    );
  }
});

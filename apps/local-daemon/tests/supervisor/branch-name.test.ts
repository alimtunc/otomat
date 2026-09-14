import { schema } from "@otomat/db";
import { COMMIT_TYPES } from "@otomat/domain";
import { afterEach, expect, it } from "vitest";

import { findActiveByOwner } from "#git/worktrees-store";
import { issueBranchName } from "#supervisor/branch-name";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { makeSupervisor } from "#test-support/supervisor";

let fix: DaemonTestDb | undefined;
afterEach(() => fix?.cleanup());

it.each([...COMMIT_TYPES, "hotfix", "release"])("respects an explicit %s title", (type) => {
  expect(
    issueBranchName(
      { title: `${type}(ui): Réparer l’affichage`, source_labels: null, source_identifier: null },
      "12345678-abcd",
    ),
  ).toBe(`${type}/reparer-l-affichage`);
});

it.each([
  ["Ajouter l’export CSV", "Type/Feature", "feat/ajouter-l-export-csv"],
  ["Réparer l’export CSV", "Type/Bug", "fix/reparer-l-export-csv"],
  ["Rétablir la connexion", "hotfix", "hotfix/retablir-la-connexion"],
  ["Nettoyer les imports", "chore", "chore/nettoyer-les-imports"],
  ["[Bug] Export invalide", null, "fix/export-invalide"],
  ["hotfix/reparer-la-connexion", null, "hotfix/reparer-la-connexion"],
  ["fix: Corriger le défilement", "Feature", "fix/corriger-le-defilement"],
  ["Build a settings page", null, "feat/build-a-settings-page"],
])("names %j using its title and labels", (title, label, expected) => {
  expect(
    issueBranchName(
      {
        title,
        source_labels: label === null ? null : [{ name: label, color: "" }],
        source_identifier: null,
      },
      "12345678-abcd",
    ),
  ).toBe(expected);
});

it("falls back to the issue reference or run suffix when the title has no usable slug", () => {
  expect(
    issueBranchName(
      { title: "🚀", source_labels: null, source_identifier: "DEV-123" },
      "12345678-abcd",
    ),
  ).toBe("feat/dev-123");
  expect(
    issueBranchName({ title: "🚀", source_labels: null, source_identifier: null }, "12345678-abcd"),
  ).toBe("feat/task-12345678");
});

it("creates the actual worktree on the issue's readable branch", async () => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({
      id: "bug-issue",
      project_id: "p1",
      title: "Réparer la connexion",
      status: "ready",
      source: "linear",
      source_external_id: "linear-bug",
      source_identifier: "DEV-123",
      source_labels: [{ name: "Type/Bug", color: "" }],
      synced_at: "2026-09-14T00:00:00.000Z",
    })
    .run();
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "bug-issue" });
  await supervisor.settle();
  expect(run.branch).toBe("fix/reparer-la-connexion");
  expect(findActiveByOwner(fix.db, run.id)?.branch).toBe(run.branch);
  expect(fix.repo.git("rev-parse", `refs/heads/${run.branch}`).trim()).toBeTruthy();
});

it("keeps an earlier run's branch when a second prompt has the same title", async () => {
  fix = setupDaemonDb();
  const { supervisor } = makeSupervisor(fix, ["complete", "complete"]);
  const first = await supervisor.start({ prompt: "feat: Export CSV" });
  await supervisor.settle();
  const head = fix.repo.git("rev-parse", `refs/heads/${first.branch}`).trim();
  const second = await supervisor.start({ prompt: "feat: Export CSV" });
  await supervisor.settle();
  expect(first.branch).toBe("feat/export-csv");
  expect(second.branch).toBe(`feat/export-csv-${second.id.slice(0, 8)}`);
  expect(fix.repo.git("rev-parse", `refs/heads/${first.branch}`).trim()).toBe(head);
  expect(findActiveByOwner(fix.db, first.id)?.branch).toBe(first.branch);
  expect(findActiveByOwner(fix.db, second.id)?.branch).toBe(second.branch);
});

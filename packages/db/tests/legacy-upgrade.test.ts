import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { issueContractSchema } from "@otomat/domain";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";
import { listIssues } from "#db/repositories/issues";

function columnName(column: unknown): string {
  if (typeof column === "object" && column !== null && "name" in column) {
    const { name } = column;
    if (typeof name === "string") return name;
  }
  throw new Error("PRAGMA table_info returned no column name");
}

const LEGACY_MIGRATIONS = [
  "0000_sticky_hellfire_club",
  "0001_famous_eternals",
  "0002_peaceful_black_bird",
  "0003_wise_dreadnoughts",
] as const;

const LEGACY_JOURNAL = {
  version: "7",
  dialect: "sqlite",
  entries: [
    { idx: 0, version: "6", when: 1781738421212, tag: LEGACY_MIGRATIONS[0], breakpoints: true },
    { idx: 1, version: "6", when: 1781824126183, tag: LEGACY_MIGRATIONS[1], breakpoints: true },
    { idx: 2, version: "6", when: 1782767699748, tag: LEGACY_MIGRATIONS[2], breakpoints: true },
    { idx: 3, version: "6", when: 1783201055217, tag: LEGACY_MIGRATIONS[3], breakpoints: true },
  ],
};

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

it("upgrades a legacy database through the current migrations", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-legacy-upgrade-"));
  const dbPath = join(dir, "otomat.db");
  const legacyMigrations = join(dir, "legacy-migrations");
  const legacyMeta = join(legacyMigrations, "meta");
  mkdirSync(legacyMeta, { recursive: true });
  for (const migration of LEGACY_MIGRATIONS) {
    copyFileSync(
      new URL(`../drizzle/${migration}.sql`, import.meta.url),
      join(legacyMigrations, `${migration}.sql`),
    );
  }
  writeFileSync(join(legacyMeta, "_journal.json"), JSON.stringify(LEGACY_JOURNAL));

  const legacy = createClient(dbPath);
  migrate(legacy.db, { migrationsFolder: legacyMigrations });
  // This fixture stops at migration 0003, so the current Drizzle schema cannot insert it.
  legacy.sqlite.exec(`
    INSERT INTO projects (id, name, root_path) VALUES ('p1', 'P', '/tmp/p');
    INSERT INTO issues (id, project_id, title, status) VALUES ('i1', 'p1', 'Issue', 'ready');
    INSERT INTO issues (id, project_id, title, status, source, source_external_id, synced_at)
    VALUES ('i2', 'p1', 'Legacy mirror', 'ready', 'linear', 'OTO-5', '2026-01-01T00:00:00.000Z');
    INSERT INTO issues (id, project_id, title, status, source, source_external_id, synced_at, updated_at)
    VALUES (
      'i3', 'p1', 'Older duplicate mirror', 'ready', 'linear', 'OTO-5',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
    INSERT INTO issues (id, project_id, title, status, source, source_external_id)
    VALUES ('i4', 'p1', 'Invalid empty mirror', 'ready', 'linear', '');
    INSERT INTO issues (id, project_id, title, status, source, source_external_id, updated_at)
    VALUES ('i5', 'p1', 'Legacy timestamp mirror', 'ready', 'github', 'GH-7', '2026-04-01 12:34:56');
    INSERT INTO runs (id, issue_id, status, branch, plan_json)
    VALUES ('r1', 'i1', 'review_ready', 'otomat/run/r1', '{"version":1,"steps":[]}');
    INSERT INTO sync_state (id, source, resource, external_id, cursor)
    VALUES
      ('sync-1', 'linear', 'issues', NULL, 'cursor-1'),
      ('sync-2', 'linear', 'issues', NULL, 'cursor-2');
    INSERT INTO sync_state (
      id, source, resource, external_id, cursor, last_synced_at, created_at, updated_at
    )
    VALUES (
      'sync-3', 'linear', 'issues', 'source-1', 'cursor-3',
      '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'
    )
  `);
  legacy.sqlite.exec(`
    INSERT INTO pull_requests (id, run_id, title, created_at, updated_at)
    VALUES
      ('older', 'r1', 'Older', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
      ('newer', 'r1', 'Newer', '2026-02-01 00:00:00', '2026-02-01 00:00:00')
  `);
  legacy.sqlite.close();

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  cleanup = () => {
    migrated.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  const rows = migrated.sqlite
    .prepare("SELECT id, publication_status FROM pull_requests WHERE run_id = ? ORDER BY id")
    .all("r1");
  expect(rows).toEqual([{ id: "newer", publication_status: "not_configured" }]);
  const issueColumns = migrated.sqlite
    .prepare("PRAGMA table_info(issues)")
    .all()
    .map((column) => columnName(column));
  const issueSourceColumns = migrated.sqlite
    .prepare("PRAGMA table_info(issue_sources)")
    .all()
    .map((column) => columnName(column));
  expect(issueColumns).toContain("source_identifier");
  expect(issueSourceColumns).toContain("source");
  const migratedIssues = migrated.sqlite
    .prepare(
      "SELECT id, source, source_external_id, source_identifier, source_url, synced_at FROM issues ORDER BY id",
    )
    .all();
  expect(migratedIssues).toEqual([
    {
      id: "i1",
      source: "local",
      source_external_id: null,
      source_identifier: null,
      source_url: null,
      synced_at: null,
    },
    {
      id: "i2",
      source: "linear",
      source_external_id: "OTO-5",
      source_identifier: "OTO-5",
      source_url: null,
      synced_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "i3",
      source: "local",
      source_external_id: null,
      source_identifier: null,
      source_url: null,
      synced_at: null,
    },
    {
      id: "i4",
      source: "local",
      source_external_id: null,
      source_identifier: null,
      source_url: null,
      synced_at: null,
    },
    {
      id: "i5",
      source: "github",
      source_external_id: "GH-7",
      source_identifier: "GH-7",
      source_url: null,
      synced_at: "2026-04-01T12:34:56.000Z",
    },
  ]);
  // `execution` is a daemon-side projection, not a persisted column; attach the no-runs default as toIssue does.
  expect(() =>
    issueContractSchema.array().parse(
      listIssues(migrated.db).map((row) => ({
        ...row,
        execution: { state: "none", run_id: null },
      })),
    ),
  ).not.toThrow();
  // 0009 drops the Linear watermark so the next sync backfills the new mirror columns.
  expect(
    migrated.sqlite.prepare("SELECT source FROM sync_state WHERE source = 'linear'").all(),
  ).toEqual([]);
  expect(() =>
    migrated.sqlite
      .prepare("INSERT INTO pull_requests (id, run_id, title) VALUES (?, ?, ?)")
      .run("duplicate", "r1", "Duplicate"),
  ).toThrow();
});

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const STEERING_MIGRATION = "0018_run_contribution_steering";

/** Stages the schema as it stood the migration before `tag`, so a data migration can be exercised on real prior rows. */
function migrateUpToExcluding(dir: string, dbPath: string, tag: string, seed: string): void {
  const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  );
  const target = journal.entries.find((entry) => entry.tag === tag);
  if (!target) throw new Error(`migration ${tag} is not in the journal`);
  const entries = journal.entries.filter((entry) => entry.idx < target.idx);

  const folder = join(dir, `before-${tag}`);
  const meta = join(folder, "meta");
  mkdirSync(meta, { recursive: true });
  for (const entry of entries) {
    copyFileSync(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      join(folder, `${entry.tag}.sql`),
    );
  }
  writeFileSync(
    join(meta, "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries }),
  );

  const prior = createClient(dbPath);
  migrate(prior.db, { migrationsFolder: folder });
  prior.sqlite.exec(seed);
  prior.sqlite.close();
}

const STEERING_SEED = `
  INSERT INTO projects (id, name, root_path) VALUES ('p1', 'P', '/tmp/p');
  INSERT INTO issues (id, project_id, title, status) VALUES ('i1', 'p1', 'Issue', 'ready');
  INSERT INTO runs (id, issue_id, status, branch, plan_json)
  VALUES ('r1', 'i1', 'review_ready', 'otomat/run/r1', '{"version":1,"steps":[]}');
  INSERT INTO step_runs (id, run_id, idx, name, status)
  VALUES ('s1', 'r1', 0, 'First', 'succeeded'), ('s2', 'r1', 1, 'Second', 'succeeded');
  INSERT INTO agent_sessions (id, step_run_id, status) VALUES ('as1', 's1', 'terminated');
  INSERT INTO run_contributions (id, run_id, seq, body, status, agent_session_id, delivered_at)
  VALUES
    ('c-session', 'r1', 0, 'carried by a turn', 'sent', 'as1', '2026-07-01T00:00:00.000Z'),
    ('c-orphan', 'r1', 1, 'never claimed', 'completed', NULL, NULL);
`;

it("gives every pre-steering message a step and renames its delivery status", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-steering-upgrade-"));
  const dbPath = join(dir, "otomat.db");
  migrateUpToExcluding(dir, dbPath, STEERING_MIGRATION, STEERING_SEED);

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  cleanup = () => {
    migrated.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  expect(
    migrated.sqlite
      .prepare("SELECT id, step_run_id, status FROM run_contributions ORDER BY seq")
      .all(),
  ).toEqual([
    // Its own session names the step; `sent` was renamed to `delivered`.
    { id: "c-session", step_run_id: "s1", status: "delivered" },
    // No session to name one, so it falls back to the run's furthest step; `completed` became `acknowledged`.
    { id: "c-orphan", step_run_id: "s2", status: "acknowledged" },
  ]);
});

const ADOPTION_MIGRATION = "0024_adopted_pull_requests";

const ADOPTION_SEED = `
  INSERT INTO projects (id, name, root_path) VALUES ('p1', 'P', '/tmp/p');
  INSERT INTO repositories (id, project_id, name) VALUES ('repo1', 'p1', 'R');
  INSERT INTO issues (id, project_id, title, status) VALUES ('i1', 'p1', 'Issue', 'ready');
  INSERT INTO runs (id, issue_id, repository_id, status, branch, plan_json)
  VALUES ('r1', 'i1', 'repo1', 'review_ready', 'otomat/run/r1', '{"version":1,"steps":[]}');
  INSERT INTO pull_requests (id, run_id, title) VALUES ('pr1', 'r1', 'feat(review): adopt');
  INSERT INTO reviews (id, run_id, status)
  VALUES ('rev-open', 'r1', 'open'), ('rev-resolved', 'r1', 'resolved');
  INSERT INTO review_comments (
    id, review_id, file_path, side, start_line, line, diff_sha, body, status,
    destination, publication_status, publication_error, external_url,
    suggestion, suggestion_original, hunk_snapshot, fix_requested_at
  )
  VALUES
    (
      'rc-agent', 'rev-open', 'src/a.ts', 'new', 10, 12, 'sha-a', 'Rename this', 'open',
      'agent', 'local', NULL, NULL, 'const a = 1;', 'const b = 1;', '@@ -1,2 +1,2 @@',
      '2026-08-01T00:00:00.000Z'
    ),
    (
      'rc-published', 'rev-open', 'src/b.ts', 'old', NULL, 3, 'sha-b', 'Published upstream',
      'addressed', 'pr_review', 'published', NULL, 'https://example.test/pr/1#c1', NULL, NULL,
      '', NULL
    ),
    (
      'rc-failed', 'rev-resolved', 'src/c.ts', 'new', NULL, NULL, 'sha-c', 'Never left', 'outdated',
      'pr_review', 'failed', 'upstream rejected the anchor', NULL, NULL, NULL, '', NULL
    );
`;

it("keeps every review and comment when the adoption rebuild replaces both tables", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-adoption-upgrade-"));
  const dbPath = join(dir, "otomat.db");
  migrateUpToExcluding(dir, dbPath, ADOPTION_MIGRATION, ADOPTION_SEED);
  const staged = createClient(dbPath);
  // SAFETY: sqlite answers each row as a column-keyed record.
  const stagedComments = staged.sqlite
    .prepare("SELECT * FROM review_comments ORDER BY id")
    .all() as Record<string, unknown>[];
  staged.sqlite.close();

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  cleanup = () => {
    migrated.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  expect(
    migrated.sqlite.prepare("SELECT id, subject_id, status FROM reviews ORDER BY id").all(),
  ).toEqual([
    { id: "rev-open", subject_id: "r1", status: "open" },
    { id: "rev-resolved", subject_id: "r1", status: "resolved" },
  ]);
  // 0025 appends `fixed_by_session_id`; every other value must survive the rebuild untouched.
  expect(migrated.sqlite.prepare("SELECT * FROM review_comments ORDER BY id").all()).toEqual(
    stagedComments.map((comment) => ({ ...comment, fixed_by_session_id: null })),
  );
  expect(migrated.sqlite.pragma("foreign_key_list(review_comments)")).toEqual([
    expect.objectContaining({ table: "reviews", from: "review_id", to: "id" }),
  ]);
  expect(migrated.sqlite.pragma("foreign_key_check")).toEqual([]);
});

it("migrates a fresh database to a review that binds a comment to any diff subject", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-fresh-upgrade-"));
  const dbPath = join(dir, "otomat.db");
  runMigrations(dbPath);
  const fresh = createClient(dbPath);
  cleanup = () => {
    fresh.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  // `subject_id` names a pull request no `runs` row could satisfy: 0024 dropped that key.
  fresh.sqlite.exec(`
    INSERT INTO reviews (id, subject_id, status) VALUES ('rev-1', 'pr-1', 'open');
    INSERT INTO review_comments (id, review_id, file_path, diff_sha, body)
    VALUES ('rc-1', 'rev-1', 'src/a.ts', 'sha-a', 'Body');
  `);
  expect(fresh.sqlite.pragma("foreign_key_check")).toEqual([]);
  expect(() =>
    fresh.sqlite
      .prepare(
        "INSERT INTO review_comments (id, review_id, file_path, diff_sha, body) VALUES (?, ?, ?, ?, ?)",
      )
      .run("rc-2", "rev-missing", "src/b.ts", "sha-b", "Body"),
  ).toThrow();
});

const TURN_INDEX_MIGRATION = "0033_handy_ser_duncan";

const TURN_INDEX_SEED = `
  INSERT INTO projects (id, name, root_path) VALUES ('p1', 'P', '/tmp/p');
  INSERT INTO issues (id, project_id, title, status) VALUES ('i1', 'p1', 'Issue', 'ready');
  INSERT INTO runs (id, issue_id, status, branch, plan_json)
  VALUES ('r1', 'i1', 'review_ready', 'otomat/run/r1', '{"version":1,"steps":[]}');
  INSERT INTO step_runs (id, run_id, idx, name, status) VALUES ('s1', 'r1', 0, 'First', 'succeeded');
  INSERT INTO agent_sessions (id, step_run_id, status, created_at)
  VALUES
    ('as-old', 's1', 'terminated', '2026-07-01 00:00:00'),
    ('as-mid', 's1', 'terminated', '2026-07-02 00:00:00'),
    ('as-new', 's1', 'terminated', '2026-07-02 00:00:00');
`;

it("numbers the turns a step already ran before the unique turn index lands", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-turn-index-upgrade-"));
  const dbPath = join(dir, "otomat.db");
  migrateUpToExcluding(dir, dbPath, TURN_INDEX_MIGRATION, TURN_INDEX_SEED);

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  cleanup = () => {
    migrated.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  expect(
    migrated.sqlite.prepare("SELECT id, turn_index FROM agent_sessions ORDER BY turn_index").all(),
  ).toEqual([
    { id: "as-old", turn_index: 0 },
    { id: "as-mid", turn_index: 1 },
    { id: "as-new", turn_index: 2 },
  ]);
});

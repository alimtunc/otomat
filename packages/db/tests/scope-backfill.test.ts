import { afterEach, expect, it } from "vitest";

import { upgradeFrom } from "#test-support/migrate-up-to";

const SCOPE_MIGRATION = "0036_agent_skill_project_scope";

const SEED = `
  INSERT INTO projects (id, name, root_path) VALUES
    ('crm', 'CRM', '/home/u/crm'),
    ('crm-extra', 'CRM extra', '/home/u/crm-extra');
  INSERT INTO skills (id, source, canonical_path, name) VALUES
    ('s-crm', 'project', '/home/u/crm/.claude/skills/crm/SKILL.md', 'CRM'),
    ('s-extra', 'project', '/home/u/crm-extra/.agents/skills/x/SKILL.md', 'X'),
    ('s-gone', 'project', '/home/u/unregistered/.agents/skills/g/SKILL.md', 'Gone'),
    ('s-user', 'user', '/home/u/.claude/skills/tdd/SKILL.md', 'TDD');
  INSERT INTO agent_profiles (id, name, runtime, options_json, skill_ids_json) VALUES
    ('user-only', 'User only', 'fake', '{}', '["s-user"]'),
    ('crm-bound', 'CRM bound', 'fake', '{}', '["s-user","s-crm"]'),
    ('extra-bound', 'Extra bound', 'fake', '{}', '["s-extra"]'),
    ('split', 'Split', 'fake', '{}', '["s-crm","s-extra"]'),
    ('bare', 'Bare', 'fake', '{}', '[]')
`;

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function migrated() {
  const upgraded = upgradeFrom("otomat-scope-backfill-", SCOPE_MIGRATION, SEED);
  cleanup = upgraded.cleanup;
  return upgraded.sqlite;
}

it("classifies existing skills by the project tree they sit in", () => {
  expect(migrated().prepare("SELECT id, project_id, status FROM skills ORDER BY id").all()).toEqual(
    [
      { id: "s-crm", project_id: "crm", status: "available" },
      { id: "s-extra", project_id: "crm-extra", status: "available" },
      // An unregistered tree fails closed rather than becoming a user skill every global agent could activate.
      { id: "s-gone", project_id: null, status: "invalid" },
      { id: "s-user", project_id: null, status: "available" },
    ],
  );
});

it("binds each existing profile to the project of the skills it referenced", () => {
  expect(
    migrated()
      .prepare("SELECT id, project_id, skill_ids_json FROM agent_profiles ORDER BY id")
      .all(),
  ).toEqual([
    { id: "bare", project_id: null, skill_ids_json: "[]" },
    { id: "crm-bound", project_id: "crm", skill_ids_json: '["s-user","s-crm"]' },
    { id: "extra-bound", project_id: "crm-extra", skill_ids_json: '["s-extra"]' },
    // A profile that spanned two projects keeps every skill id: the foreign one reads as out of scope instead of vanishing.
    { id: "split", project_id: "crm", skill_ids_json: '["s-crm","s-extra"]' },
    { id: "user-only", project_id: null, skill_ids_json: '["s-user"]' },
  ]);
});

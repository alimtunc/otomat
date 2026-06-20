import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createClient, runMigrations, schema, type DbClient } from "@otomat/db";

const TEST_IDENTITY = {
  GIT_AUTHOR_NAME: "Otomat Test",
  GIT_AUTHOR_EMAIL: "test@otomat.local",
  GIT_COMMITTER_NAME: "Otomat Test",
  GIT_COMMITTER_EMAIL: "test@otomat.local",
} as const;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...TEST_IDENTITY },
  }).toString();
}

export interface TestRepo {
  root: string;
  defaultBranch: string;
  write(relPath: string, content: string): void;
  remove(relPath: string): void;
  commitAll(message: string): string;
  git(...args: string[]): string;
  cleanup(): void;
}

/** A temp git repo on `main` with one initial commit. */
export function setupTestRepo(): TestRepo {
  const root = mkdtempSync(join(tmpdir(), "otomat-git-repo-"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Otomat Test");
  git(root, "config", "user.email", "test@otomat.local");
  writeFileSync(join(root, "README.md"), "# base\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "init");

  return {
    root,
    defaultBranch: "main",
    write(relPath, content) {
      const full = join(root, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    remove(relPath) {
      rmSync(join(root, relPath), { force: true });
    },
    commitAll(message) {
      git(root, "add", "-A");
      git(root, "commit", "-m", message);
      return git(root, "rev-parse", "HEAD").trim();
    },
    git: (...args) => git(root, ...args),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export interface TestDb {
  client: DbClient;
  dir: string;
  repositoryId: string;
  cleanup(): void;
}

/** A migrated temp DB with a project + repository row so worktree FKs resolve. */
export function setupTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), "otomat-git-db-"));
  const dbPath = join(dir, "otomat.db");
  runMigrations(dbPath);
  const client = createClient(dbPath);
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: dir }).run();
  client.db
    .insert(schema.repositories)
    .values({ id: "repo-1", project_id: "p1", name: "R", default_branch: "main" })
    .run();

  return {
    client,
    dir,
    repositoryId: "repo-1",
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

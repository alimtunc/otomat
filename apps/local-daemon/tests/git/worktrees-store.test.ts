import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findActiveByOwner,
  insertWorktree,
  listWorktreeRows,
  updateWorktreeStatus,
} from "#git/worktrees-store";

import { setupGitDb, type GitTestDb } from "../support/git.js";

describe("worktrees-store", () => {
  let db: GitTestDb;

  beforeEach(() => {
    db = setupGitDb();
  });

  afterEach(() => {
    db.cleanup();
  });

  it("round-trips and lists worktree rows", () => {
    insertWorktree(db.client.db, {
      id: "w1",
      repository_id: db.repositoryId,
      path: "/tmp/w1",
      branch: "b1",
      head_sha: "deadbeef",
      owner_token: "owner-1",
      status: "active",
    });

    expect(findActiveByOwner(db.client.db, "owner-1")?.id).toBe("w1");
    expect(listWorktreeRows(db.client.db, { repositoryId: db.repositoryId })).toHaveLength(1);
  });

  it("enforces one active worktree per owner via the partial unique index", () => {
    insertWorktree(db.client.db, {
      id: "w1",
      repository_id: db.repositoryId,
      path: "/tmp/w1",
      branch: "b1",
      owner_token: "shared-owner",
      status: "active",
    });

    expect(() =>
      insertWorktree(db.client.db, {
        id: "w2",
        repository_id: db.repositoryId,
        path: "/tmp/w2",
        branch: "b2",
        owner_token: "shared-owner",
        status: "active",
      }),
    ).toThrow();
  });

  it("allows a new active row for an owner once the prior is archived", () => {
    insertWorktree(db.client.db, {
      id: "w1",
      repository_id: db.repositoryId,
      path: "/tmp/w1",
      branch: "b1",
      owner_token: "owner-1",
      status: "active",
    });
    updateWorktreeStatus(db.client.db, "w1", { status: "archived" });

    expect(() =>
      insertWorktree(db.client.db, {
        id: "w2",
        repository_id: db.repositoryId,
        path: "/tmp/w2",
        branch: "b2",
        owner_token: "owner-1",
        status: "active",
      }),
    ).not.toThrow();
  });
});

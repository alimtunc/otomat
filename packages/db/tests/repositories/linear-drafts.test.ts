import { afterEach, beforeEach, expect, it } from "vitest";

import {
  deleteLinearDraft,
  getLinearDraft,
  upsertLinearDraft,
} from "#db/repositories/linear-drafts";

import { createTempDb, seedReviewRun, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-linear-drafts-");
  seedReviewRun(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("keeps a single draft per issue and updates it in place", () => {
  const { db } = t.client;
  upsertLinearDraft(db, {
    id: "draft-1",
    issue_id: "i1",
    base_updated_at: "2026-07-21T10:00:00.000Z",
    title: "Edited title",
    description: "Edited body",
    priority: 2,
    assignee_id: "user-1",
    label_ids: ["label-1"],
  });

  expect(getLinearDraft(db, "i1")).toMatchObject({
    id: "draft-1",
    issue_id: "i1",
    base_updated_at: "2026-07-21T10:00:00.000Z",
    title: "Edited title",
    priority: 2,
    assignee_id: "user-1",
    label_ids: ["label-1"],
  });

  upsertLinearDraft(db, {
    id: "draft-2",
    issue_id: "i1",
    base_updated_at: "2026-07-21T11:00:00.000Z",
    title: "Newer title",
    description: null,
    priority: 0,
    assignee_id: null,
    label_ids: [],
  });

  const draft = getLinearDraft(db, "i1");
  expect(draft?.id).toBe("draft-1");
  expect(draft).toMatchObject({
    title: "Newer title",
    description: null,
    priority: 0,
    assignee_id: null,
    label_ids: [],
    base_updated_at: "2026-07-21T11:00:00.000Z",
  });
});

it("removes a draft only on explicit discard", () => {
  const { db } = t.client;
  upsertLinearDraft(db, {
    id: "draft-1",
    issue_id: "i1",
    base_updated_at: "2026-07-21T10:00:00.000Z",
    title: "Edited",
    description: null,
    priority: 0,
    assignee_id: null,
    label_ids: [],
  });
  expect(getLinearDraft(db, "i1")).toBeDefined();
  deleteLinearDraft(db, "i1");
  expect(getLinearDraft(db, "i1")).toBeUndefined();
});

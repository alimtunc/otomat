import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { schema, type Db, upsertMirroredIssue } from "@otomat/db";
import type { SaveLinearDraftRequest } from "@otomat/domain";

import {
  createLinearService,
  type LinearApiClient,
  type LinearIssueDetail,
  type LinearService,
} from "#linear";

import { setupTestDb } from "./db.js";
import { stubLinearApiClient } from "./linear.js";

export const API_KEY = "lin_api_secret_do_not_leak";
export const BASE = "2026-07-20T10:00:00.000Z";
export const REMOTE_CHANGED = "2026-07-21T09:00:00.000Z";
export const COMMENT_UUID = "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
export const PR_URL = "https://github.com/acme/repo/pull/42";

type LinearApiOverrides = Parameters<typeof stubLinearApiClient>[0];

export interface LinearWritebackTest {
  db: Db;
  cleanup: () => void;
  connectedService: (overrides?: LinearApiOverrides) => Promise<LinearService>;
  createService: (client: LinearApiClient) => LinearService;
  readLedger: (runId: string) => string;
  seedLinearIssue: (updatedAt?: string) => void;
  seedRun: () => void;
}

export function linearDetail(overrides: Partial<LinearIssueDetail> = {}): LinearIssueDetail {
  return {
    external_id: "L-1",
    identifier: "OTO-99",
    title: "Mirror",
    description: "Body",
    url: "https://linear.app/otomat/issue/OTO-99",
    updated_at: BASE,
    priority: 2,
    assignee: { id: "u1", name: "Alim" },
    labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
    state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
    ...overrides,
  };
}

export function draftRequest(
  overrides: Partial<SaveLinearDraftRequest> = {},
): SaveLinearDraftRequest {
  return {
    base_updated_at: BASE,
    title: "Mirror",
    description: "Body",
    priority: 2,
    assignee_id: "u1",
    label_ids: ["lab1"],
    ...overrides,
  };
}

export function setupLinearWritebackTest(): LinearWritebackTest {
  const testDb = setupTestDb("otomat-linear-writeback-");
  let counter = 0;

  function seedLinearIssue(updatedAt = BASE): void {
    upsertMirroredIssue(testDb.db, {
      id: "li",
      project_id: "p1",
      source: "linear",
      source_external_id: "L-1",
      source_identifier: "OTO-99",
      source_url: "https://linear.app/otomat/issue/OTO-99",
      title: "Mirror",
      body: "Body",
      status: "ready",
      synced_at: BASE,
      source_updated_at: updatedAt,
      source_assignee_name: null,
      source_priority: 2,
      source_labels: null,
      source_state_name: null,
      source_state_color: null,
    });
  }

  function seedRun(): void {
    testDb.db
      .insert(schema.runs)
      .values({
        id: "r1",
        issue_id: "li",
        status: "running",
        branch: "otomat/run/r1",
        plan_json: { version: 1, steps: [] },
      })
      .run();
  }

  function createService(client: LinearApiClient): LinearService {
    return createLinearService({
      db: testDb.db,
      dataDir: testDb.dir,
      client,
      idFactory: () => `id-${(counter += 1)}`,
      now: () => new Date("2026-07-21T12:00:00.000Z"),
    });
  }

  async function connectedService(overrides: LinearApiOverrides = {}): Promise<LinearService> {
    const service = createService(
      stubLinearApiClient({
        viewer: async () => ({
          user_name: "Alim",
          workspace_id: "w1",
          workspace_name: "Otomat",
        }),
        ...overrides,
      }),
    );
    await service.connect(API_KEY);
    return service;
  }

  function readLedger(runId: string): string {
    const file = join(testDb.dir, "runs", runId, "events.jsonl");
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  }

  return {
    db: testDb.db,
    cleanup: testDb.cleanup,
    connectedService,
    createService,
    readLedger,
    seedLinearIssue,
    seedRun,
  };
}

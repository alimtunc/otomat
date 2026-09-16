import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Hono } from "hono";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createReviewService } from "#review";

import { makeApiApp } from "./api.js";
import { seedRepository, setupTestDb } from "./db.js";
import { setupTestRepo, stubRepositoryResolver, type TestRepo } from "./git.js";
import { seedRun } from "./seed.js";

export const FILES_RUN_ID = "run-files";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]);

export interface CheckoutApiFixture {
  repo: TestRepo;
  service: GitWorktreeService;
  worktree: string;
  app: Hono;
  cleanup(): void;
}

export function setupCheckoutApi(): CheckoutApiFixture {
  const t = setupTestDb("otomat-run-files-api-");
  seedRepository(t.db);
  const repo = setupTestRepo();
  repo.write("src/app.ts", "export const a = 1;\n");
  repo.write("assets/pixel.png", PNG_BYTES.toString("latin1"));
  repo.commitAll("seed");
  const worktreesRoot = mkdtempSync(join(tmpdir(), "otomat-files-api-wt-"));
  const service = createGitWorktreeService({
    db: t.db,
    repositoryId: "repo-1",
    repoRoot: repo.root,
    defaultBranch: "main",
    worktreesRoot,
  });
  const acquired = service.acquire({ owner: FILES_RUN_ID, branch: "feat/files" });
  seedRun(t.db, {
    runId: FILES_RUN_ID,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const repositories = stubRepositoryResolver(service, { rootPath: repo.root });
  const app = makeApiApp(t, {
    repositories,
    review: createReviewService({
      db: t.db,
      dataDir: t.dir,
      repositories,
      appendRunStep: () => Promise.reject(new Error("not used")),
      submitPullRequestReview: () => Promise.reject(new Error("not used")),
      syncViewedFile: () => Promise.reject(new Error("not used")),
      readViewedFiles: () => Promise.reject(new Error("not used")),
    }),
  });
  return {
    repo,
    service,
    worktree: acquired.path,
    app,
    cleanup: () => {
      rmSync(worktreesRoot, { recursive: true, force: true });
      repo.cleanup();
      t.cleanup();
    },
  };
}

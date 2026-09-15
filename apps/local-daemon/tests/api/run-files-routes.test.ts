import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ReviewDiffResponse,
  WorktreeFileContent,
  WorktreeFileSaved,
  WorktreeFilesResponse,
} from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createReviewService } from "#review";

import { json, makeApiApp, put, request } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { setupTestRepo, stubRepositoryResolver, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "run-files";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x01]);

let t: TestDb;
let repo: TestRepo;
let worktreesRoot: string;
let service: GitWorktreeService;
let worktree: string;
let app: Hono;

async function openText(path: string) {
  const res = await request(app, `/api/runs/${RUN_ID}/files/content?path=${path}`);
  expect(res.status).toBe(200);
  const body = await json<WorktreeFileContent>(res);
  if (body.kind !== "text") throw new Error(`expected text, got ${body.kind}`);
  return body;
}

beforeEach(() => {
  t = setupTestDb("otomat-run-files-api-");
  seedRepository(t.db);
  repo = setupTestRepo();
  repo.write("src/app.ts", "export const a = 1;\n");
  repo.write("assets/pixel.png", PNG_BYTES.toString("latin1"));
  repo.commitAll("seed");
  worktreesRoot = mkdtempSync(join(tmpdir(), "otomat-files-api-wt-"));
  service = createGitWorktreeService({
    db: t.db,
    repositoryId: "repo-1",
    repoRoot: repo.root,
    defaultBranch: "main",
    worktreesRoot,
  });
  const acquired = service.acquire({ owner: RUN_ID, branch: "feat/files" });
  worktree = acquired.path;
  seedRun(t.db, {
    runId: RUN_ID,
    repositoryId: "repo-1",
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const repositories = stubRepositoryResolver(service, { rootPath: repo.root });
  app = makeApiApp(t, {
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
});

afterEach(() => {
  rmSync(worktreesRoot, { recursive: true, force: true });
  repo.cleanup();
  t.cleanup();
});

it("lists the whole worktree tree without depending on the diff", async () => {
  const res = await request(app, `/api/runs/${RUN_ID}/files`);
  expect(res.status).toBe(200);
  const body = await json<WorktreeFilesResponse>(res);
  expect(body.editable).toBe(true);
  expect(body.entries.map((entry) => entry.path)).toEqual([
    "README.md",
    "assets/pixel.png",
    "src/app.ts",
  ]);
});

it("saves a text file at its revision and the canonical diff shows the change", async () => {
  const opened = await openText("src/app.ts");
  const saved = await put(app, `/api/runs/${RUN_ID}/files/content`, {
    path: "src/app.ts",
    revision: opened.revision,
    text: "export const a = 2;\n",
  });
  expect(saved.status).toBe(200);
  expect((await json<WorktreeFileSaved>(saved)).revision).not.toBe(opened.revision);

  const diff = await json<ReviewDiffResponse>(await request(app, `/api/runs/${RUN_ID}/diff`));
  expect(diff.diff?.files.map((file) => file.path)).toEqual(["src/app.ts"]);
  expect((await openText("src/app.ts")).text).toBe("export const a = 2;\n");
});

it("refuses a save whose revision another writer moved", async () => {
  const opened = await openText("src/app.ts");
  writeFileSync(join(worktree, "src/app.ts"), "export const a = 'agent';\n");
  const res = await put(app, `/api/runs/${RUN_ID}/files/content`, {
    path: "src/app.ts",
    revision: opened.revision,
    text: "mine\n",
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "file_revision_stale" });
  expect((await openText("src/app.ts")).text).toBe("export const a = 'agent';\n");
});

it("refuses traversal, absolute paths, binaries and oversized files", async () => {
  const content = `/api/runs/${RUN_ID}/files/content`;
  expect((await request(app, `${content}?path=../etc/passwd`)).status).toBe(400);
  expect((await request(app, `${content}?path=/etc/passwd`)).status).toBe(400);
  expect((await request(app, `${content}?path=missing.ts`)).status).toBe(404);
  writeFileSync(join(worktree, "blob.bin"), Buffer.alloc(3));
  expect((await request(app, `${content}?path=blob.bin`)).status).toBe(409);
  writeFileSync(join(worktree, "huge.txt"), "x".repeat(1024 * 1024 + 1));
  expect((await request(app, `${content}?path=huge.txt`)).status).toBe(413);
  const media = await json<WorktreeFileContent>(
    await request(app, `${content}?path=assets/pixel.png`),
  );
  expect(media).toMatchObject({ kind: "media", media_type: "image/png" });

  const opened = await openText("src/app.ts");
  const escaped = await put(app, content, { path: "../x", revision: opened.revision, text: "" });
  expect(escaped.status).toBe(400);
});

it("keeps an archived branch readable but never writable", async () => {
  const opened = await openText("src/app.ts");
  service.archive(RUN_ID);

  const listed = await json<WorktreeFilesResponse>(await request(app, `/api/runs/${RUN_ID}/files`));
  expect(listed.editable).toBe(false);
  expect((await openText("src/app.ts")).text).toBe("export const a = 1;\n");
  const res = await put(app, `/api/runs/${RUN_ID}/files/content`, {
    path: "src/app.ts",
    revision: opened.revision,
    text: "nope\n",
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "workspace_read_only" });
});

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ReviewDiffResponse,
  WorktreeFileContent,
  WorktreeFileSaved,
  WorktreeFilesResponse,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, put, request } from "../support/api.js";
import {
  FILES_RUN_ID as RUN_ID,
  setupCheckoutApi,
  type CheckoutApiFixture,
} from "../support/checkout-api.js";

let fix: CheckoutApiFixture;

async function openText(path: string) {
  const res = await request(fix.app, `/api/runs/${RUN_ID}/files/content?path=${path}`);
  expect(res.status).toBe(200);
  const body = await json<WorktreeFileContent>(res);
  if (body.kind !== "text") throw new Error(`expected text, got ${body.kind}`);
  return body;
}

beforeEach(() => {
  fix = setupCheckoutApi();
});

afterEach(() => fix.cleanup());

it("lists the whole worktree tree without depending on the diff", async () => {
  const res = await request(fix.app, `/api/runs/${RUN_ID}/files`);
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
  const saved = await put(fix.app, `/api/runs/${RUN_ID}/files/content`, {
    path: "src/app.ts",
    revision: opened.revision,
    text: "export const a = 2;\n",
  });
  expect(saved.status).toBe(200);
  expect((await json<WorktreeFileSaved>(saved)).revision).not.toBe(opened.revision);

  const diff = await json<ReviewDiffResponse>(await request(fix.app, `/api/runs/${RUN_ID}/diff`));
  expect(diff.diff?.files.map((file) => file.path)).toEqual(["src/app.ts"]);
  expect((await openText("src/app.ts")).text).toBe("export const a = 2;\n");
});

it("refuses a save whose revision another writer moved", async () => {
  const opened = await openText("src/app.ts");
  writeFileSync(join(fix.worktree, "src/app.ts"), "export const a = 'agent';\n");
  const res = await put(fix.app, `/api/runs/${RUN_ID}/files/content`, {
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
  expect((await request(fix.app, `${content}?path=../etc/passwd`)).status).toBe(400);
  expect((await request(fix.app, `${content}?path=/etc/passwd`)).status).toBe(400);
  expect((await request(fix.app, `${content}?path=missing.ts`)).status).toBe(404);
  writeFileSync(join(fix.worktree, "blob.bin"), Buffer.alloc(3));
  expect((await request(fix.app, `${content}?path=blob.bin`)).status).toBe(409);
  writeFileSync(join(fix.worktree, "huge.txt"), "x".repeat(1024 * 1024 + 1));
  expect((await request(fix.app, `${content}?path=huge.txt`)).status).toBe(413);
  const media = await json<WorktreeFileContent>(
    await request(fix.app, `${content}?path=assets/pixel.png`),
  );
  expect(media).toMatchObject({ kind: "media", media_type: "image/png" });

  const opened = await openText("src/app.ts");
  const escaped = await put(fix.app, content, {
    path: "../x",
    revision: opened.revision,
    text: "",
  });
  expect(escaped.status).toBe(400);
});

it("keeps an archived branch readable but never writable", async () => {
  const opened = await openText("src/app.ts");
  fix.service.archive(RUN_ID);

  const listed = await json<WorktreeFilesResponse>(
    await request(fix.app, `/api/runs/${RUN_ID}/files`),
  );
  expect(listed.editable).toBe(false);
  expect((await openText("src/app.ts")).text).toBe("export const a = 1;\n");
  const res = await put(fix.app, `/api/runs/${RUN_ID}/files/content`, {
    path: "src/app.ts",
    revision: opened.revision,
    text: "nope\n",
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "workspace_read_only" });
});

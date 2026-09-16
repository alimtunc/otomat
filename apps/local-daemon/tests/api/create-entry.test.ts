import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { repositoryTreeResponseSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { post, request } from "../support/api.js";
import { setupCheckoutApi, type CheckoutApiFixture } from "../support/checkout-api.js";

let fix: CheckoutApiFixture;
beforeEach(() => {
  fix = setupCheckoutApi();
});
afterEach(() => fix.cleanup());

it.each([
  ["/api/repositories/repo-1/tree", "repository"],
  ["/api/runs/run-files/files", "run"],
])(
  "creates folders and editable empty files in the isolated checkout at %s",
  async (endpoint, kind) => {
    const root = kind === "run" ? fix.worktree : fix.repo.root;
    const other = kind === "run" ? fix.repo.root : fix.worktree;
    const before = fix.repo.git("diff", "--cached");
    expect((await post(fix.app, endpoint, { path: "empty", kind: "directory" })).status).toBe(201);
    expect(
      (await post(fix.app, endpoint, { path: "empty/nested", kind: "directory" })).status,
    ).toBe(201);
    const listing = await request(fix.app, endpoint);
    expect(await listing.json()).toMatchObject({
      entries: expect.arrayContaining([
        { path: "empty", kind: "directory", size: 0 },
        { path: "empty/nested", kind: "directory", size: 0 },
      ]),
    });
    expect(
      (await post(fix.app, endpoint, { path: "empty/nested/file.ts", kind: "file" })).status,
    ).toBe(201);
    expect(readFileSync(join(root, "empty/nested/file.ts"), "utf8")).toBe("");
    expect(existsSync(join(other, "empty"))).toBe(false);
    expect(fix.repo.git("diff", "--cached")).toBe(before);
    const content = await request(fix.app, `${endpoint}/content?path=empty/nested/file.ts`);
    expect(await content.json()).toMatchObject({
      kind: "text",
      path: "empty/nested/file.ts",
      text: "",
      revision: expect.any(String),
    });
  },
);

it("refuses existing paths, missing parents, traversal, Git internals and ignored entries", async () => {
  const endpoint = "/api/repositories/repo-1/tree";
  for (const path of [
    "../escape",
    "/tmp/escape",
    ".git/config",
    "src/.git/config",
    "src/../../escape",
    "bad\0name",
    "bad\\name",
  ])
    expect((await post(fix.app, endpoint, { path, kind: "file" })).status, path).toBe(400);
  for (const kind of ["file", "directory"])
    expect((await post(fix.app, endpoint, { path: "src/app.ts", kind })).status).toBe(409);
  expect(readFileSync(join(fix.repo.root, "src/app.ts"), "utf8")).toBe("export const a = 1;\n");
  expect((await post(fix.app, endpoint, { path: "missing/file.ts", kind: "file" })).status).toBe(
    409,
  );
  fix.repo.write(".gitignore", "ignored/\n*.secret\n");
  for (const entry of [
    { path: "ignored", kind: "directory" },
    { path: "key.secret", kind: "file" },
  ]) {
    const response = await post(fix.app, endpoint, entry);
    expect(await response.json()).toMatchObject({ error: "path_ignored" });
    expect(existsSync(join(fix.repo.root, entry.path))).toBe(false);
  }
});

it("never creates through symlinks or inside a nested repository", async () => {
  const endpoint = "/api/repositories/repo-1/tree";
  symlinkSync(fix.worktree, join(fix.repo.root, "escape"));
  symlinkSync(join(fix.repo.root, "src"), join(fix.repo.root, "internal-link"));
  for (const path of ["escape/new.ts", "internal-link/new.ts"])
    expect(await (await post(fix.app, endpoint, { path, kind: "file" })).json()).toMatchObject({
      error: "file_symlink",
    });
  expect(existsSync(join(fix.worktree, "new.ts"))).toBe(false);
  expect(lstatSync(join(fix.repo.root, "internal-link")).isSymbolicLink()).toBe(true);
  mkdirSync(join(fix.repo.root, "nested/.git"), { recursive: true });
  expect((await post(fix.app, endpoint, { path: "nested/new.ts", kind: "file" })).status).toBe(400);
});

it("does not expose ignored folders or symlink targets, and refuses archived worktree writes", async () => {
  fix.repo.write(".gitignore", "empty/ignored/\n");
  mkdirSync(join(fix.repo.root, "empty/ignored"), { recursive: true });
  mkdirSync(join(fix.repo.root, "empty/visible"));
  symlinkSync(fix.worktree, join(fix.repo.root, "empty/escape"));
  const listing = await request(fix.app, "/api/repositories/repo-1/tree");
  const body = repositoryTreeResponseSchema.parse(await listing.json());
  expect(body.entries).toContainEqual({ path: "empty/visible", kind: "directory", size: 0 });
  expect(body.entries).not.toContainEqual(expect.objectContaining({ path: "empty/ignored" }));
  expect(body.entries).not.toContainEqual(expect.objectContaining({ path: "empty/escape/src" }));
  fix.service.archive("run-files");
  const refused = await post(fix.app, "/api/runs/run-files/files", { path: "nope", kind: "file" });
  expect(await refused.json()).toMatchObject({ error: "workspace_read_only" });
});

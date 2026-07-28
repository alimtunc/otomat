import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const GUARDRAILS_SCRIPT = fileURLToPath(new URL("./guardrails.mjs", import.meta.url));
const fixtures = [];

async function createFixture(files) {
  const root = await mkdtemp(join(tmpdir(), "otomat-guardrails-"));
  fixtures.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  return root;
}

function runGuardrails(root) {
  return spawnSync(process.execPath, [GUARDRAILS_SCRIPT], {
    cwd: root,
    encoding: "utf8",
  });
}

function lines(count) {
  return Array.from({ length: count }, (_, index) => `export const value${index} = ${index};`).join(
    "\n",
  );
}

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((fixture) => rm(fixture, { force: true, recursive: true })),
  );
});

test("rejects a new runtime source file above 250 lines", async () => {
  const root = await createFixture({
    "apps/web/src/oversized.ts": lines(251),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /source-file-size/);
  assert.match(guardrails.stderr, /apps\/web\/src\/oversized\.ts/);
});

test("accepts an oversized legacy file at its ratcheted baseline", async () => {
  const root = await createFixture({
    "apps/local-daemon/src/legacy.ts": lines(275),
    "scripts/source-size-baseline.json": `${JSON.stringify(
      { "apps/local-daemon/src/legacy.ts": 275 },
      null,
      2,
    )}\n`,
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 0, guardrails.stderr);
});

test("accepts a runtime source file at exactly 250 lines", async () => {
  const root = await createFixture({
    "apps/web/src/at-limit.ts": lines(250),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 0, guardrails.stderr);
});

test("requires removing the baseline entry once a legacy file fits the limit", async () => {
  const root = await createFixture({
    "packages/domain/src/legacy.ts": lines(240),
    "scripts/source-size-baseline.json": `${JSON.stringify(
      { "packages/domain/src/legacy.ts": 275 },
      null,
      2,
    )}\n`,
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /source-size-baseline/);
  assert.match(guardrails.stderr, /remove its baseline entry/);
});

test("requires lowering the baseline when a legacy file shrinks", async () => {
  const root = await createFixture({
    "packages/domain/src/legacy.ts": lines(260),
    "scripts/source-size-baseline.json": `${JSON.stringify(
      { "packages/domain/src/legacy.ts": 275 },
      null,
      2,
    )}\n`,
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /source-size-baseline/);
  assert.match(guardrails.stderr, /lower its baseline from 275 to 260/);
});

test("does not treat a re-export-only index as runtime implementation", async () => {
  const barrel = [
    "/** Public package surface. */",
    ...Array.from(
      { length: 251 },
      (_, index) => `export { value${index} } from "./module-${index}";`,
    ),
  ].join("\n");
  const root = await createFixture({
    "packages/ui/src/index.ts": barrel,
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 0, guardrails.stderr);
});

test("rejects a stale baseline entry after its legacy file is removed", async () => {
  const root = await createFixture({
    "scripts/source-size-baseline.json": `${JSON.stringify(
      { "apps/web/src/removed.ts": 300 },
      null,
      2,
    )}\n`,
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /source-size-baseline/);
  assert.match(guardrails.stderr, /Remove its stale baseline entry/);
});

test("does not exempt an index file that exports runtime implementation", async () => {
  const root = await createFixture({
    "packages/client/src/index.ts": lines(251),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /source-file-size/);
  assert.match(guardrails.stderr, /packages\/client\/src\/index\.ts/);
});

test("rejects a helper exported from a component file", async () => {
  const root = await createFixture({
    "apps/web/src/widget.tsx": [
      "export function Widget() { return null; }",
      'export function formatWidget() { return ""; }',
    ].join("\n"),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /export-shape/);
  assert.match(guardrails.stderr, /formatWidget/);
});

test("rejects unrelated components sharing one file", async () => {
  const root = await createFixture({
    "apps/web/src/widget.tsx": [
      "export function Widget() { return null; }",
      "export function Gadget() { return null; }",
    ].join("\n"),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /unrelated components share this file/);
});

test("accepts a compound component family with anchored types", async () => {
  const root = await createFixture({
    "apps/web/src/card.tsx": [
      "export interface CardProps { title?: string }",
      "export function Card() { return null; }",
      "export function CardHeader() { return null; }",
      "export type CardTone = 'flat' | 'raised';",
    ].join("\n"),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 0, guardrails.stderr);
});

test("accepts a baselined export-shape violation and rejects a stale one", async () => {
  const files = {
    "apps/web/src/widget.tsx": [
      "export function Widget() { return null; }",
      'export function formatWidget() { return ""; }',
    ].join("\n"),
  };
  const allowed = await createFixture({
    ...files,
    "scripts/export-shape-baseline.json": `${JSON.stringify(
      { "apps/web/src/widget.tsx": ["formatWidget"] },
      null,
      2,
    )}\n`,
  });
  const stale = await createFixture({
    ...files,
    "scripts/export-shape-baseline.json": `${JSON.stringify(
      { "apps/web/src/widget.tsx": ["formatWidget", "legacyHelper"] },
      null,
      2,
    )}\n`,
  });

  assert.equal(runGuardrails(allowed).status, 0);
  const guardrails = runGuardrails(stale);
  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /export-shape-baseline/);
  assert.match(guardrails.stderr, /legacyHelper/);
});

test("rejects a non-hook export from a use-* module", async () => {
  const root = await createFixture({
    "apps/web/src/use-thing.ts": [
      "export function useThing() { return 1; }",
      "export const THING_LIMIT = 2;",
    ].join("\n"),
  });

  const guardrails = runGuardrails(root);

  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /export-shape/);
  assert.match(guardrails.stderr, /THING_LIMIT/);
});

test("rejects an index.ts holding implementation, except entrypoints", async () => {
  const impure = await createFixture({
    "apps/web/src/widgets/index.ts": "export const widgetCount = 1;",
  });
  const entrypoint = await createFixture({
    "apps/local-daemon/src/index.ts": "const port = 4319;\nconsole.log(port);",
  });

  const guardrails = runGuardrails(impure);
  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /barrel-purity/);
  assert.equal(runGuardrails(entrypoint).status, 0);
});

test("rejects three same-prefix siblings unless the cluster is baselined", async () => {
  const files = {
    "apps/web/src/lib/foo-alpha.ts": "export const alpha = 1;",
    "apps/web/src/lib/foo-beta.ts": "export const beta = 2;",
    "apps/web/src/lib/foo-gamma.ts": "export const gamma = 3;",
  };
  const bare = await createFixture(files);
  const baselined = await createFixture({
    ...files,
    "scripts/structure-baseline.json": `${JSON.stringify(
      { domainFolders: ["apps/web/src/lib#foo"] },
      null,
      2,
    )}\n`,
  });

  const guardrails = runGuardrails(bare);
  assert.equal(guardrails.status, 1);
  assert.match(guardrails.stderr, /domain-folder/);
  assert.match(guardrails.stderr, /`foo\/` domain folder/);
  assert.equal(runGuardrails(baselined).status, 0);
});

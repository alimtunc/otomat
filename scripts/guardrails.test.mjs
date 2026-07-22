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

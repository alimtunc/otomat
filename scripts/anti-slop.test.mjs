import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");
const config = join(root, ".oxlintrc.json");

function lint(source) {
  const directory = mkdtempSync(join(tmpdir(), "otomat-anti-slop-"));
  const fixture = join(directory, "fixture.ts");
  writeFileSync(fixture, source);
  const result = spawnSync(oxlint, ["--config", config, fixture], {
    cwd: root,
    encoding: "utf8",
  });
  rmSync(directory, { recursive: true, force: true });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("reports ephemeral issue and pull request references in comments", () => {
  const result = lint(`
// OTO-128 introduced this value.
/* See PR #42 for the implementation history. */
/** https://github.com/example/repository/issues/7 */
export const value = 1;
`);

  assert.equal(result.status, 1, result.output);
  assert.equal(result.output.match(/anti-slop\(no-ephemeral-comment-references\)/gu)?.length, 3);
});

test("accepts durable technical references and reasons", () => {
  const result = lint(`
// The upstream payload requires ISO-8601 rather than a locale-dependent value.
// SAFETY: validation above proves the indexed record exists.
export const value = 1;
`);

  assert.equal(result.status, 0, result.output);
});

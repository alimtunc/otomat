import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");
const config = join(root, ".oxlintrc.react.json");

function lint(source) {
  const directory = mkdtempSync(join(tmpdir(), "otomat-react-lint-"));
  const fixture = join(directory, "fixture.tsx");
  writeFileSync(fixture, source);
  const result = spawnSync(oxlint, ["--config", config, fixture], {
    cwd: root,
    encoding: "utf8",
  });
  rmSync(directory, { recursive: true, force: true });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("rejects a state update during render", () => {
  const result = lint(`
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  setCount(count + 1);
  return <output>{count}</output>;
}
`);

  assert.equal(result.status, 1);
  assert.match(result.output, /react\(set-state-in-render\)/u);
});

test("accepts a state update from an event", () => {
  const result = lint(`
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>{count}</button>;
}
`);

  assert.equal(result.status, 0, result.output);
});

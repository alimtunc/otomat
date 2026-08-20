import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reactDoctor = join(root, "node_modules", ".bin", "react-doctor");
const config = JSON.parse(
  readFileSync(join(root, "doctor.config.json"), "utf8").replace(/^\s*\/\/.*$/gmu, ""),
);

test("keeps React Doctor local, changed-scope, and non-overlapping", () => {
  assert.equal(config.scope, "changed");
  assert.equal(config.blocking, "warning");
  assert.equal(config.noScore, true);
  assert.equal(config.supplyChain.enabled, false);
  assert.equal(config.deadCode, false);
  assert.equal(config.adoptExistingLintConfig, false);
  assert.deepEqual(config.categories, {
    Maintainability: "off",
    Performance: "off",
    Security: "off",
  });

  const result = spawnSync(reactDoctor, ["rules", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);

  const configuredRules = new Map(
    JSON.parse(result.stdout).map((rule) => [rule.key, rule.severity]),
  );
  assert.equal(configuredRules.get("react-doctor/no-ref-current-in-render"), "error");
  for (const rule of Object.keys(config.rules)) {
    assert.equal(configuredRules.get(rule), "off", rule);
  }
});

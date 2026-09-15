import assert from "node:assert/strict";
import { test } from "node:test";

import { formatVersion, nextVersionProblem, parseVersion, versionChoices } from "./version.mjs";

const ALPHA = parseVersion("0.1.0-alpha.1");
const STABLE = parseVersion("0.1.0");

test("parses SemVer core and prerelease, refuses everything else", () => {
  assert.deepEqual(ALPHA, { major: 0, minor: 1, patch: 0, prerelease: ["alpha", "1"] });
  assert.deepEqual(STABLE, { major: 0, minor: 1, patch: 0, prerelease: [] });
  for (const invalid of [
    "v1.0.0",
    "1.0",
    "01.0.0",
    "1.0.0-",
    "1.0.0-alpha..1",
    "1.0.0+build",
    "",
  ]) {
    assert.equal(parseVersion(invalid), null, invalid);
  }
});

test("formats what it parsed", () => {
  for (const text of ["0.1.0-alpha.1", "0.1.0", "10.20.30-rc.1.beta"]) {
    assert.equal(formatVersion(parseVersion(text)), text);
  }
});

test("orders candidates by SemVer precedence", () => {
  const ordered = [
    "0.9.9",
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.1",
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    const [lower, higher] = [ordered[index - 1], ordered[index]];
    assert.equal(nextVersionProblem(parseVersion(lower), higher), null, `${lower} < ${higher}`);
    assert.match(nextVersionProblem(parseVersion(higher), lower), /not above/);
    assert.match(nextVersionProblem(parseVersion(higher), higher), /not above/);
  }
});

test("offers the next prerelease first, and no prerelease from a stable version", () => {
  assert.deepEqual(versionChoices(ALPHA), [
    { label: "next prerelease", version: "0.1.0-alpha.2" },
    { label: "stable", version: "0.1.0" },
    { label: "next minor", version: "0.2.0" },
    { label: "next major", version: "1.0.0" },
  ]);
  assert.equal(versionChoices(parseVersion("0.1.0-alpha"))[0].version, "0.1.0-alpha.1");
  assert.deepEqual(versionChoices(STABLE), [
    { label: "next patch", version: "0.1.1" },
    { label: "next minor", version: "0.2.0" },
    { label: "next major", version: "1.0.0" },
  ]);
});

test("refuses a candidate that is not SemVer or not above the current version", () => {
  assert.match(nextVersionProblem(ALPHA, "v0.1.0-alpha.2"), /not a SemVer version/);
  assert.match(nextVersionProblem(ALPHA, "0.1.0-alpha.1"), /not above the current 0.1.0-alpha.1/);
  assert.match(nextVersionProblem(ALPHA, "0.0.9"), /not above/);
  assert.match(nextVersionProblem(STABLE, "0.1.0-alpha.2"), /not above/);
  assert.equal(nextVersionProblem(ALPHA, "0.1.0-alpha.2"), null);
  assert.equal(nextVersionProblem(ALPHA, "0.1.0"), null);
  assert.equal(nextVersionProblem(STABLE, "0.1.1-alpha.1"), null);
});

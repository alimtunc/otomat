#!/usr/bin/env node
// CI ratchet: baseline files may shrink but never gain or raise entries.
// Compares the working tree's baselines against a base ref (default origin/main);
// a baseline file absent from the base ref is skipped so it can be introduced.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ref = process.argv[2] ?? "origin/main";
const failures = [];

try {
  execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { stdio: "pipe" });
} catch {
  console.error(`baseline-anti-ratchet: ref \`${ref}\` not found. Fetch it before running.`);
  process.exit(1);
}

function refJson(path) {
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch {
    return null;
  }
}

function workingJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function compare(path, check) {
  const base = refJson(path);
  const head = workingJson(path);
  if (base === null || head === null) return;
  check(base, head, (message) => failures.push(`${path}: ${message}`));
}

compare("scripts/source-size-baseline.json", (base, head, fail) => {
  for (const [file, lines] of Object.entries(head)) {
    if (!(file in base)) fail(`new entry \`${file}\` — split the file instead of baselining it.`);
    else if (lines > base[file]) {
      fail(`\`${file}\` raised from ${base[file]} to ${lines} lines — baselines only shrink.`);
    }
  }
});

compare("scripts/export-shape-baseline.json", (base, head, fail) => {
  for (const [file, symbols] of Object.entries(head)) {
    if (!(file in base)) {
      fail(`new entry \`${file}\` — fix the export shape instead of baselining it.`);
      continue;
    }
    const allowed = new Set(base[file]);
    for (const symbol of symbols) {
      if (!allowed.has(symbol)) fail(`\`${file}\` gained \`${symbol}\` — baselines only shrink.`);
    }
  }
});

compare("scripts/structure-baseline.json", (base, head, fail) => {
  for (const group of ["barrels", "domainFolders"]) {
    const allowed = new Set(base[group] ?? []);
    for (const entry of head[group] ?? []) {
      if (!allowed.has(entry)) {
        fail(`new ${group} entry \`${entry}\` — fix the structure instead of baselining it.`);
      }
    }
  }
});

if (failures.length > 0) {
  console.error(`Baseline anti-ratchet: ${failures.length} violation(s) vs ${ref}\n`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`Baseline anti-ratchet: no violations vs ${ref}.`);

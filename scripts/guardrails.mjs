#!/usr/bin/env node
// Architecture and frontend rules oxlint cannot express. Run via `pnpm guardrails`;
// each rule's intent lives in its report() message.

import { relative } from "node:path";

import { checkExportShape } from "./guardrails/export-shape.mjs";
import { checkFrontendIdioms } from "./guardrails/frontend-idioms.mjs";
import { checkSourceSize } from "./guardrails/source-size.mjs";
import { checkStructure } from "./guardrails/structure.mjs";

const ROOT = process.cwd();
const violations = [];

function report(file, line, col, code, message) {
  violations.push(`${relative(ROOT, file)}:${line}:${col}: error ${code}: ${message}`);
}

checkSourceSize(ROOT, report);
checkFrontendIdioms(ROOT, report);
checkExportShape(ROOT, report);
checkStructure(ROOT, report);

if (violations.length > 0) {
  console.error(`Frontend guardrails: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log("Frontend guardrails: no violations.");

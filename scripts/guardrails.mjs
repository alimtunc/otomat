#!/usr/bin/env node
// Architecture and frontend rules oxlint cannot express. Run via `pnpm guardrails`;
// each rule's intent lives in its report() message.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["apps/web/src", "packages/ui/src"];
const SOURCE_SCAN_DIRS = [
  "apps/web/src",
  "apps/local-daemon/src",
  "apps/desktop/src",
  "packages/client/src",
  "packages/db/src",
  "packages/domain/src",
  "packages/ui/src",
];
const SOURCE_LINE_LIMIT = 250;
const SOURCE_SIZE_BASELINE_PATH = join(ROOT, "scripts/source-size-baseline.json");
const SOURCE_SIZE_BASELINE = existsSync(SOURCE_SIZE_BASELINE_PATH)
  ? JSON.parse(readFileSync(SOURCE_SIZE_BASELINE_PATH, "utf8"))
  : {};
const ALLOW_EFFECT_MARKER = "otomat-allow-effect";

const SPACING_PREFIXES = [
  "max-w",
  "min-w",
  "max-h",
  "min-h",
  "size",
  "w",
  "h",
  "gap-x",
  "gap-y",
  "gap",
  "space-x",
  "space-y",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "p",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "m",
  "inset-x",
  "inset-y",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "translate-x",
  "translate-y",
];

const USE_EFFECT_RE = /(?:^|[^.\w])useEffect\s*\(|\bReact\.useEffect\s*\(/;
const IMPORT_RE = /^\s*import\b/;
const REEXPORT_STATEMENT_RE =
  /^export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|{[\s\S]*})\s+from\s+["'][^"']+["']$/;
// `\s` spans newlines, so this catches both `cond && <X/>` and `cond &&\n  <X/>`.
const AND_JSX_RE = /&&\s*\(?\s*<[A-Za-z>/]/g;
const SPACING_RE = new RegExp(`(?<![\\w-])(${SPACING_PREFIXES.join("|")})-\\[(\\d+)px\\]`, "g");
function listFiles(dir) {
  const abs = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(abs, { recursive: true });
  } catch {
    return [];
  }
  return entries
    .map((e) => join(abs, e))
    .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p) && !/routeTree\.gen\.ts$/.test(p))
    .filter((p) => statSync(p).isFile());
}

const violations = [];
const checkedBaselinePaths = new Set();
function report(file, line, col, code, message) {
  violations.push(`${relative(ROOT, file)}:${line}:${col}: error ${code}: ${message}`);
}

function lineColAt(src, index) {
  const upto = src.slice(0, index);
  return { line: upto.split("\n").length, col: index - upto.lastIndexOf("\n") };
}

function lineCount(source) {
  if (source.length === 0) return 0;
  const count = source.split(/\r\n|\r|\n/).length;
  return /(?:\r\n|\r|\n)$/.test(source) ? count - 1 : count;
}

function isReexportOnlyBarrel(file, source) {
  if (basename(file) !== "index.ts") return false;
  const implementation = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const statements = implementation
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  return (
    statements.length > 0 && statements.every((statement) => REEXPORT_STATEMENT_RE.test(statement))
  );
}

for (const dir of SOURCE_SCAN_DIRS) {
  for (const file of listFiles(dir)) {
    const source = readFileSync(file, "utf8");
    if (isReexportOnlyBarrel(file, source)) continue;
    const lines = lineCount(source);
    const path = relative(ROOT, file);
    checkedBaselinePaths.add(path);
    const baselineLines = SOURCE_SIZE_BASELINE[path];
    const allowedLines = baselineLines ?? SOURCE_LINE_LIMIT;
    if (lines > allowedLines) {
      report(
        file,
        allowedLines + 1,
        1,
        "source-file-size",
        `Runtime source files must stay at or below ${allowedLines} lines; this file has ${lines}. Split it by responsibility.`,
      );
    }
    if (baselineLines !== undefined && lines < baselineLines) {
      report(
        file,
        1,
        1,
        "source-size-baseline",
        `This file shrank to ${lines} lines; lower its baseline from ${baselineLines} to ${lines}.`,
      );
    }
  }
}

for (const path of Object.keys(SOURCE_SIZE_BASELINE)) {
  if (checkedBaselinePaths.has(path)) continue;
  report(
    join(ROOT, path),
    1,
    1,
    "source-size-baseline",
    "This runtime implementation no longer exists. Remove its stale baseline entry.",
  );
}

for (const dir of SCAN_DIRS) {
  for (const file of listFiles(dir)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");

    lines.forEach((text, i) => {
      // 1. useEffect
      if (!IMPORT_RE.test(text) && USE_EFFECT_RE.test(text)) {
        const onSameLine = text.includes(ALLOW_EFFECT_MARKER);
        let prev = i - 1;
        while (prev >= 0 && lines[prev].trim() === "") prev--;
        const documented = onSameLine || (prev >= 0 && lines[prev].includes(ALLOW_EFFECT_MARKER));
        if (!documented) {
          report(
            file,
            i + 1,
            text.indexOf("useEffect") + 1,
            "no-undocumented-use-effect",
            `useEffect is banned by default. If it is genuinely required, add a "${ALLOW_EFFECT_MARKER}: <reason>" comment directly above the call.`,
          );
        }
      }

      // 3. canonical Tailwind spacing
      for (const m of text.matchAll(SPACING_RE)) {
        const [token, prefix, pxRaw] = m;
        report(
          file,
          i + 1,
          (m.index ?? 0) + 1,
          "tailwind-canonical-spacing",
          `\`${token}\` should be written as \`${prefix}-${Number(pxRaw) / 4}\`.`,
        );
      }
    });

    // 2. cond && <JSX> (full-text, so multi-line renders are caught too)
    for (const m of src.matchAll(AND_JSX_RE)) {
      const { line, col } = lineColAt(src, m.index ?? 0);
      report(
        file,
        line,
        col,
        "no-and-jsx",
        "Conditional render with `&&` is banned. Use `condition ? <Component /> : null`.",
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`Frontend guardrails: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log("Frontend guardrails: no violations.");

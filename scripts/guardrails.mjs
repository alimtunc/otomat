#!/usr/bin/env node
// Frontend lint rules oxlint cannot express (useEffect / &&-JSX / Tailwind spacing / no lucide-react in apps/web),
// over apps/web + packages/ui. Run via `pnpm guardrails`; each rule's intent lives in its report() message.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["apps/web/src", "packages/ui/src"];
const ALLOW_EFFECT_MARKER = "otomat-allow-effect";

const SPACING_PREFIXES = [
  "max-w", "min-w", "max-h", "min-h", "size", "w", "h",
  "gap-x", "gap-y", "gap", "space-x", "space-y",
  "px", "py", "pt", "pr", "pb", "pl", "p",
  "mx", "my", "mt", "mr", "mb", "ml", "m",
  "inset-x", "inset-y", "inset", "top", "right", "bottom", "left", "start", "end",
  "translate-x", "translate-y",
];

const USE_EFFECT_RE = /(?:^|[^.\w])useEffect\s*\(|\bReact\.useEffect\s*\(/;
const IMPORT_RE = /^\s*import\b/;
// `\s` spans newlines, so this catches both `cond && <X/>` and `cond &&\n  <X/>`.
const AND_JSX_RE = /&&\s*\(?\s*<[A-Za-z>/]/g;
const SPACING_RE = new RegExp(
  `(?<![\\w-])(${SPACING_PREFIXES.join("|")})-\\[(\\d+)px\\]`,
  "g",
);
// lucide-react is centralized behind @otomat/ui <Icon />; apps/web must never name it directly.
const LUCIDE_RE = /["']lucide-react["']/g;
const WEB_DIR = "apps/web/src";

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
function report(file, line, col, code, message) {
  violations.push(`${relative(ROOT, file)}:${line}:${col}: error ${code}: ${message}`);
}

function lineColAt(src, index) {
  const upto = src.slice(0, index);
  return { line: upto.split("\n").length, col: index - upto.lastIndexOf("\n") };
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
        const documented =
          onSameLine || (prev >= 0 && lines[prev].includes(ALLOW_EFFECT_MARKER));
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

    // 4. lucide-react in apps/web (must go through @otomat/ui <Icon /> + IconName)
    if (dir === WEB_DIR) {
      for (const m of src.matchAll(LUCIDE_RE)) {
        const { line, col } = lineColAt(src, m.index ?? 0);
        report(
          file,
          line,
          col,
          "no-lucide-in-web",
          'Direct lucide-react import is banned in apps/web. Use `<Icon name="…" />` and `IconName` from @otomat/ui.',
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Frontend guardrails: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log("Frontend guardrails: no violations.");

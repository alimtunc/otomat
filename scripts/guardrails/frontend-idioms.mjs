import { readFileSync } from "node:fs";

import { lineColAt, listFiles, SCAN_DIRS } from "./files.mjs";

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
// `\s` spans newlines, so this catches both `cond && <X/>` and `cond &&\n  <X/>`.
const AND_JSX_RE = /&&\s*\(?\s*<[A-Za-z>/]/g;
const SPACING_RE = new RegExp(`(?<![\\w-])(${SPACING_PREFIXES.join("|")})-\\[(\\d+)px\\]`, "g");

export function checkFrontendIdioms(root, report) {
  for (const dir of SCAN_DIRS) {
    for (const file of listFiles(root, dir)) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");

      lines.forEach((text, i) => {
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
}

import { readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { listFiles, readBaseline, SCAN_DIRS } from "./files.mjs";

const BASELINE_PATH = "scripts/export-shape-baseline.json";
const EXPORT_DECL_RE =
  /^export\s+(?:default\s+)?(?:async\s+)?(function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_BRACE_RE = /^export\s+(type\s+)?\{([^}]*)\}(\s*from\s*["'][^"']+["'])?/gm;

function exportedSymbols(source) {
  const symbols = new Map();
  for (const line of source.split("\n")) {
    const decl = line.match(EXPORT_DECL_RE);
    if (decl) {
      const kind = ["interface", "type", "enum"].includes(decl[1]) ? "type" : "value";
      symbols.set(decl[2], kind);
    }
  }
  for (const m of source.matchAll(EXPORT_BRACE_RE)) {
    if (m[3] !== undefined) continue;
    for (const raw of m[2].split(",")) {
      let member = raw.trim();
      if (!member) continue;
      const typed = Boolean(m[1]) || member.startsWith("type ");
      member = member.replace(/^type\s+/, "");
      const name = member
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && !symbols.has(name)) symbols.set(name, typed ? "type" : "value");
    }
  }
  return [...symbols].map(([name, kind]) => ({ name, kind }));
}

const isComponentName = (name) => /^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name);

function commonPrefixLength(names) {
  let prefix = names[0];
  for (const name of names.slice(1)) {
    let length = 0;
    while (length < prefix.length && length < name.length && prefix[length] === name[length]) {
      length++;
    }
    prefix = prefix.slice(0, length);
  }
  return prefix.length;
}

function typeAnchored(name, components) {
  return components.some(
    (component) =>
      name.startsWith(component) ||
      (component.endsWith("s") && name.startsWith(component.slice(0, -1))),
  );
}

function fileViolations(file, source) {
  const symbols = exportedSymbols(source);
  const violations = new Map();
  if (/^use-[\w-]+\.tsx?$/.test(basename(file))) {
    for (const { name, kind } of symbols) {
      if (kind === "value" && !/^use[A-Z]/.test(name)) {
        violations.set(
          name,
          `\`${name}\` is not a hook. A use-* module exports one hook plus its types; move this to a sibling .ts module.`,
        );
      }
    }
    return violations;
  }
  const components = symbols
    .filter(({ name, kind }) => kind === "value" && isComponentName(name))
    .map(({ name }) => name);
  for (const { name, kind } of symbols) {
    if (kind === "value" && !isComponentName(name)) {
      violations.set(
        name,
        `\`${name}\` is a helper, hook, or constant exported from a component file. Move it to its own module.`,
      );
    } else if (kind === "type" && !typeAnchored(name, components)) {
      violations.set(
        name,
        `type \`${name}\` is not this component's contract. Move it to its owning module.`,
      );
    }
  }
  if (components.length >= 2 && commonPrefixLength(components) < 4) {
    for (const component of components) {
      violations.set(
        component,
        `\`${component}\`: unrelated components share this file. Keep one component (plus compound subcomponents) per file.`,
      );
    }
  }
  return violations;
}

export function checkExportShape(root, report) {
  const baseline = readBaseline(root, BASELINE_PATH);
  const seenPaths = new Set();

  for (const dir of SCAN_DIRS) {
    for (const file of listFiles(root, dir)) {
      const name = basename(file);
      if (!name.endsWith(".tsx") && !/^use-[\w-]+\.ts$/.test(name)) continue;
      const path = relative(root, file);
      seenPaths.add(path);
      const violations = fileViolations(file, readFileSync(file, "utf8"));
      const allowed = new Set(baseline[path] ?? []);
      for (const [symbol, message] of violations) {
        if (!allowed.delete(symbol)) report(file, 1, 1, "export-shape", message);
      }
      for (const gone of allowed) {
        report(
          file,
          1,
          1,
          "export-shape-baseline",
          `\`${gone}\` no longer violates export shape; remove it from ${BASELINE_PATH}.`,
        );
      }
    }
  }

  for (const path of Object.keys(baseline)) {
    if (seenPaths.has(path)) continue;
    report(
      join(root, path),
      1,
      1,
      "export-shape-baseline",
      `This file no longer exists. Remove its stale entry from ${BASELINE_PATH}.`,
    );
  }
}

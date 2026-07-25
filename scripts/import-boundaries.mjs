#!/usr/bin/env node
// Dep-free import-boundary gate. Replaces dependency-cruiser, which cannot parse
// the repo's TypeScript 7 (tsgo) sources without a legacy `typescript` parser dep.
// It reconstructs the import graph from `git ls-files` and enforces the layering
// documented in docs/ai/import-boundaries.md. Run via `pnpm boundaries`.
//
// Not enforced here (was not enforced before either, since the gate parsed zero
// TypeScript): that every bare npm specifier is a declared dependency. `pnpm
// install` and `pnpm typecheck` cover that; the heavy-lib specifiers below are
// still checked by name.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const HEAVY_LIBS = ["react", "react-dom", "better-sqlite3", "drizzle-orm", "drizzle-kit"];
const BACKEND_PKGS = new Set(["db", "supervisor", "integrations", "review"]);
const FRONTEND_PKGS = new Set(["ui", "client", "domains"]);
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "console", "crypto", "dgram",
  "dns", "events", "fs", "http", "http2", "https", "net", "os", "path",
  "perf_hooks", "process", "querystring", "readline", "stream", "string_decoder",
  "timers", "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

const violations = [];
function report(file, line, code, message) {
  violations.push(`${relative(ROOT, file)}:${line}: error ${code}: ${message}`);
}

const PRUNE_DIRS = new Set([
  "node_modules", "dist", ".git", ".data", "release", ".daemon", "drizzle", "coverage", ".turbo",
]);

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNE_DIRS.has(entry.name)) walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const allTsFiles = [];
for (const top of ["apps", "packages"]) walk(resolve(ROOT, top), allTsFiles);
const allFiles = new Set(allTsFiles);
const sourceFiles = allTsFiles.filter(
  (p) => /\/(apps|packages)\/[^/]+\/src\//.test(p) && !/routeTree\.gen\.ts$/.test(p),
);

const packages = [];
for (const top of ["apps", "packages"]) {
  for (const entry of readdirSync(resolve(ROOT, top), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(ROOT, top, entry.name, "package.json");
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    packages.push({ name: manifest.name, dir: dirname(manifestPath), imports: manifest.imports ?? {} });
  }
}
const packageByName = new Map(packages.map((p) => [p.name, p]));

function owningPackage(file) {
  return packages
    .filter((p) => file.startsWith(`${p.dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];
}

const EXTENSIONS = ["", ".ts", ".tsx"];
function resolveToFile(base) {
  const candidates = [];
  if (/\.(js|jsx)$/.test(base)) candidates.push(base.replace(/\.(js|jsx)$/, ".ts"), base.replace(/\.(js|jsx)$/, ".tsx"));
  for (const ext of EXTENSIONS) candidates.push(base + ext);
  candidates.push(join(base, "index.ts"), join(base, "index.tsx"));
  return candidates.find((c) => allFiles.has(c)) ?? null;
}

function resolveHashImport(specifier, owner) {
  for (const [pattern, target] of Object.entries(owner.imports)) {
    if (typeof target !== "string") continue;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      if (specifier.startsWith(prefix)) {
        return resolveToFile(resolve(owner.dir, target.replace("*", specifier.slice(prefix.length))));
      }
    } else if (specifier === pattern) {
      return resolveToFile(resolve(owner.dir, target));
    }
  }
  return null;
}

// Classify a specifier into an edge target for the graph and the boundary rules.
function classify(specifier, fromFile) {
  if (specifier.startsWith("node:")) return { kind: "core", name: specifier.slice(5) };
  if (specifier.startsWith("@web/")) {
    return { kind: "local", file: resolveToFile(resolve(ROOT, "apps/web/src", specifier.slice(5))) };
  }
  if (specifier.startsWith(".")) {
    return { kind: "local", file: resolveToFile(resolve(dirname(fromFile), specifier)) };
  }
  if (specifier.startsWith("#")) {
    const owner = owningPackage(fromFile);
    return { kind: "local", file: owner ? resolveHashImport(specifier, owner) : null };
  }
  if (specifier.startsWith("@otomat/")) {
    const [, name, sub] = specifier.match(/^(@otomat\/[^/]+)(?:\/(.+))?$/) ?? [];
    const pkg = packageByName.get(name);
    if (pkg === undefined) return { kind: "workspace", targetPkg: name, file: null };
    const base = sub === undefined ? join(pkg.dir, "src/index") : join(pkg.dir, "src", sub);
    return { kind: "workspace", targetPkg: name, file: resolveToFile(base) };
  }
  if (NODE_BUILTINS.has(specifier.split("/")[0])) return { kind: "core", name: specifier };
  return { kind: "external", name: specifier };
}

const IMPORT_RE =
  /\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(file) {
  const source = readFileSync(file, "utf8");
  const found = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier === undefined) continue;
    const line = source.slice(0, match.index).split("\n").length;
    found.push({ specifier, line });
  }
  return found;
}

function layerOf(file) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("packages/domain/")) return "domain";
  if (rel.startsWith("apps/web/") || rel.startsWith("apps/desktop/")) return "frontend";
  if (/^packages\/(ui|client)\//.test(rel)) return "frontend";
  if (rel.startsWith("apps/local-daemon/")) return "backend";
  if (rel.startsWith("packages/db/")) return "backend";
  return "other";
}

function otomatPkgSuffix(targetPkg) {
  return targetPkg?.startsWith("@otomat/") ? targetPkg.slice("@otomat/".length) : null;
}

const graph = new Map();
for (const file of sourceFiles) {
  const layer = layerOf(file);
  const edges = [];
  for (const { specifier, line } of importsOf(file)) {
    if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|eot|json|md|txt|wasm)$/.test(specifier)) {
      continue;
    }
    const target = classify(specifier, file);
    const suffix = otomatPkgSuffix(target.targetPkg);
    const base = specifier.split("/")[0];

    if (layer === "domain" && target.kind === "external" && HEAVY_LIBS.includes(base)) {
      report(file, line, "domain-no-heavy-libs", `packages/domain must not import ${base}.`);
    }
    if (layer === "domain" && target.kind === "core") {
      report(file, line, "domain-no-node-core", `packages/domain must stay Node-agnostic: ${specifier}.`);
    }
    if (layer === "domain" && suffix !== null && suffix !== "domain") {
      report(file, line, "domain-stays-pure", `packages/domain must not import ${target.targetPkg}.`);
    }
    if (layer === "frontend" && (BACKEND_PKGS.has(suffix) || target.file?.includes("/apps/local-daemon/"))) {
      report(file, line, "frontend-not-to-backend", `Frontend must not import ${target.targetPkg ?? specifier}.`);
    }
    if (layer === "backend" && FRONTEND_PKGS.has(suffix)) {
      report(file, line, "backend-not-to-frontend", `Backend must not import ${target.targetPkg}.`);
    }
    if ((target.kind === "local" || target.kind === "workspace") && target.file === null) {
      report(file, line, "unresolved-import", `Local/workspace import does not resolve: ${specifier}.`);
    }
    if (target.file !== null && target.file !== undefined) edges.push(target.file);
  }
  graph.set(file, edges);
}

// Cycle detection: DFS back-edge over the resolved local + workspace edges.
const WHITE = 0, GREY = 1, BLACK = 2;
const color = new Map();
const stack = [];
function findCycle(node) {
  color.set(node, GREY);
  stack.push(node);
  for (const next of graph.get(node) ?? []) {
    if (!graph.has(next)) continue;
    if (color.get(next) === GREY) {
      const cycle = stack.slice(stack.indexOf(next)).map((f) => relative(ROOT, f));
      return [...cycle, relative(ROOT, next)];
    }
    if ((color.get(next) ?? WHITE) === WHITE) {
      const found = findCycle(next);
      if (found) return found;
    }
  }
  stack.pop();
  color.set(node, BLACK);
  return null;
}
for (const file of sourceFiles) {
  if ((color.get(file) ?? WHITE) === WHITE) {
    const cycle = findCycle(file);
    if (cycle) {
      report(resolve(ROOT, cycle[0]), 1, "no-circular", `Import cycle: ${cycle.join(" -> ")}.`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error(`Import boundaries: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(v);
  process.exit(1);
}
console.log(`Import boundaries: no violations (${sourceFiles.length} source files).`);

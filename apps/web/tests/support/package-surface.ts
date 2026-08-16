import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The workspace packages apps/web reaches only through their built entry point. */
const CONSUMED = ["domain", "ui", "client"];

const PACKAGES = resolve(import.meta.dirname, "../../../../packages");

const REEXPORT_ALL = /export\s+\*\s+from\s*["']([^"']+)["']/g;
const REEXPORT_NAMED = /export\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;
const DECLARATION =
  /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

const CANDIDATE_SUFFIXES = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx", "/index.js"];

/** Source and emitted barrels carry the same specifiers, so one resolver walks either tree. */
function resolveModule(fromFile: string, specifier: string): string | null {
  const base = join(dirname(fromFile), specifier.replace(/\.js$/, ""));
  return CANDIDATE_SUFFIXES.map((suffix) => base + suffix).find(existsSync) ?? null;
}

/** Type-only entries are dropped: they leave no symbol in the emitted JavaScript to compare against. */
function namedValues(list: string): string[] {
  const names: string[] = [];
  for (const raw of list.split(",")) {
    const member = raw.trim();
    if (member.length === 0 || member.startsWith("type ")) continue;
    const name = member
      .split(/\s+as\s+/)
      .pop()
      ?.trim();
    if (name !== undefined && name.length > 0) names.push(name);
  }
  return names;
}

function collectValueExports(file: string, into: Set<string>, seen: Set<string>): void {
  if (seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const [, name] of source.matchAll(DECLARATION)) if (name !== undefined) into.add(name);
  for (const [, typed, list, specifier] of source.matchAll(REEXPORT_NAMED)) {
    if (typed !== undefined || list === undefined || specifier === undefined) continue;
    for (const name of namedValues(list)) into.add(name);
  }
  for (const [, specifier] of source.matchAll(REEXPORT_ALL)) {
    if (specifier === undefined) continue;
    const target = resolveModule(file, specifier);
    if (target !== null) collectValueExports(target, into, seen);
  }
}

function barrelValueExports(entry: string): Set<string> {
  const names = new Set<string>();
  collectValueExports(entry, names, new Set());
  return names;
}

function missingFromBuild(name: string): string[] {
  const packageDir = join(PACKAGES, name);
  const built = join(packageDir, "dist/index.js");
  if (!existsSync(built)) return ["<the whole package>"];
  const distributed = barrelValueExports(built);
  return [...barrelValueExports(join(packageDir, "src/index.ts"))].filter(
    (symbol) => !distributed.has(symbol),
  );
}

/**
 * apps/web resolves every `@otomat/*` import to the package's `dist`, so a
 * suite run against a stale build tests a surface that no longer exists — the
 * symbol is simply `undefined` at the call site, far from its cause.
 */
export default function verifyPackageSurface(): void {
  const stale = CONSUMED.map((name) => ({ name, missing: missingFromBuild(name) })).filter(
    (entry) => entry.missing.length > 0,
  );
  if (stale.length === 0) return;
  const detail = stale
    .map((entry) => `  @otomat/${entry.name} is missing ${entry.missing.join(", ")}`)
    .join("\n");
  throw new Error(
    `These packages export more than their build does, so apps/web would test a stale surface:\n${detail}\nRun \`pnpm build\` first.`,
  );
}

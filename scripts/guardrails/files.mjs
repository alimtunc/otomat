import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export const SCAN_DIRS = ["apps/web/src", "packages/ui/src"];
export const SOURCE_SCAN_DIRS = [
  "apps/web/src",
  "apps/local-daemon/src",
  "apps/desktop/src",
  "packages/client/src",
  "packages/db/src",
  "packages/domain/src",
  "packages/ui/src",
];

export function listFiles(root, dir) {
  const abs = join(root, dir);
  let entries;
  try {
    entries = readdirSync(abs, { recursive: true });
  } catch {
    return [];
  }
  return entries
    .map((e) => join(abs, e))
    .filter(
      (p) =>
        /\.(ts|tsx)$/.test(p) &&
        !/\.test\.tsx?$/.test(p) &&
        !p.endsWith(".d.ts") &&
        !p.endsWith("routeTree.gen.ts"),
    )
    .filter((p) => statSync(p).isFile());
}

export function readBaseline(root, relPath) {
  const abs = join(root, relPath);
  return existsSync(abs) ? JSON.parse(readFileSync(abs, "utf8")) : {};
}

export function lineCount(source) {
  if (source.length === 0) return 0;
  const count = source.split(/\r\n|\r|\n/).length;
  return /(?:\r\n|\r|\n)$/.test(source) ? count - 1 : count;
}

export function lineColAt(src, index) {
  const upto = src.slice(0, index);
  return { line: upto.split("\n").length, col: index - upto.lastIndexOf("\n") };
}

const REEXPORT_STATEMENT_RE =
  /^export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|{[\s\S]*})\s+from\s+["'][^"']+["']$/;

export function isReexportOnlyBarrel(file, source) {
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

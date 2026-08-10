import type { ChangeStatus } from "./types.js";

function mapStatusCode(code: string): ChangeStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    default:
      return "modified";
  }
}

export interface StatusEntry {
  path: string;
  oldPath: string | null;
  status: ChangeStatus;
}

export function parseNameStatusZ(out: string): StatusEntry[] {
  const fields = out.split("\0");
  const entries: StatusEntry[] = [];
  let i = 0;
  while (i < fields.length) {
    const code = fields[i++];
    if (code === "" || code === undefined) continue;
    if (code[0] === "R" || code[0] === "C") {
      const oldPath = fields[i++] ?? "";
      const path = fields[i++] ?? "";
      entries.push({ path, oldPath, status: mapStatusCode(code) });
    } else {
      const path = fields[i++] ?? "";
      entries.push({ path, oldPath: null, status: mapStatusCode(code) });
    }
  }
  return entries;
}

export interface CountEntry {
  additions: number;
  deletions: number;
  binary: boolean;
}

export function parseNumstatZ(out: string): Map<string, CountEntry> {
  const tokens = out.split("\0");
  const counts = new Map<string, CountEntry>();
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i++];
    if (tok === "" || tok === undefined) continue;
    const firstTab = tok.indexOf("\t");
    if (firstTab === -1) continue;
    const secondTab = tok.indexOf("\t", firstTab + 1);
    const addStr = tok.slice(0, firstTab);
    const delStr = tok.slice(firstTab + 1, secondTab);
    const pathPart = tok.slice(secondTab + 1);
    let path = pathPart;
    if (pathPart === "") {
      i++; // skip the rename source; counts key on the destination path
      path = tokens[i++] ?? "";
    }
    const binary = addStr === "-" || delStr === "-";
    counts.set(path, {
      additions: binary ? 0 : Number.parseInt(addStr, 10),
      deletions: binary ? 0 : Number.parseInt(delStr, 10),
      binary,
    });
  }
  return counts;
}

// git appends a literal TAB separator to `+++ b/<path>` / `--- a/<path>` lines
// when the path contains whitespace; an unquoted path never contains a TAB.
function stripPathTrailer(path: string): string {
  const tab = path.indexOf("\t");
  return tab === -1 ? path : path.slice(0, tab);
}

function patchSectionPath(body: string[]): string | null {
  let renameTo: string | null = null;
  let plusPath: string | null = null;
  let minusPath: string | null = null;
  for (const line of body) {
    if (line.startsWith("rename to ")) renameTo = line.slice("rename to ".length);
    else if (line.startsWith("+++ b/")) plusPath = stripPathTrailer(line.slice(6));
    else if (line.startsWith("--- a/")) minusPath = stripPathTrailer(line.slice(6));
  }
  if (renameTo) return renameTo;
  if (plusPath) return plusPath;
  if (minusPath) return minusPath;
  const header = /^diff --git a\/(.*) b\/(.*)$/.exec(body[0] ?? "");
  return header ? header[2] : null;
}

export function splitPatchByFile(patch: string): Map<string, string> {
  const sections = new Map<string, string>();
  let body: string[] = [];
  const flush = () => {
    if (body.length === 0) return;
    const path = patchSectionPath(body);
    if (path) sections.set(path, body.join("\n"));
    body = [];
  };
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      body = [line];
    } else if (body.length > 0) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

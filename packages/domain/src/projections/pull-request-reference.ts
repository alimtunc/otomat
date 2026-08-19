import type { IssueReference, IssueReferenceSurface } from "../contracts/pull-request-import.js";

/** Bounded on both sides so an identifier is read as one value: `OTO-1190` yields itself, and the `119` in `daemon 119` yields nothing. */
const IDENTIFIER = /(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]*-\d+(?![A-Za-z0-9])/g;

const EXCERPT_LIMIT = 120;
const EXCERPT_LEAD = 40;

export interface IssueReferenceSurfaces {
  title: string;
  body: string | null;
  branch: string | null;
}

/** Windowed on the match, because a line truncated from its start drops the very identifier the excerpt has to prove. */
function excerptAt(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const from = Math.max(0, Math.min(index - lineStart - EXCERPT_LEAD, line.length - EXCERPT_LIMIT));
  const to = from + EXCERPT_LIMIT;
  const window = line.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${window}${to < line.length ? "…" : ""}`;
}

function readSurface(surface: IssueReferenceSurface, text: string | null): IssueReference[] {
  if (text === null) return [];
  return [...text.matchAll(IDENTIFIER)].map((match) => ({
    identifier: match[0],
    surface,
    excerpt: excerptAt(text, match.index),
  }));
}

export function findIssueReferences(surfaces: IssueReferenceSurfaces): IssueReference[] {
  return [
    ...readSurface("title", surfaces.title),
    ...readSurface("body", surfaces.body),
    ...readSurface("branch", surfaces.branch),
  ];
}

export function matchIssueReference(
  identifier: string,
  surfaces: IssueReferenceSurfaces,
): IssueReference | null {
  const wanted = identifier.toLowerCase();
  const found = findIssueReferences(surfaces).find(
    (reference) => reference.identifier.toLowerCase() === wanted,
  );
  // The requested spelling is the canonical one a surface quotes back; only the excerpt keeps the branch's own casing.
  return found === undefined ? null : { ...found, identifier };
}

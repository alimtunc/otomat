import { parsePatchHunks, type DiffFileContract, type PatchLine } from "@otomat/domain";
import { occurrenceOffsets } from "@web/components/runs/diff/search/occurrences";

/** Counted once per patch line whatever renders it: split mode prints a context line twice. */
export interface DiffSearchMatch {
  path: string;
  oldLine: number | null;
  newLine: number | null;
  /** Rank of this occurrence among the ones on its own line. */
  occurrence: number;
}

type DiffSearchIndex = ReadonlyMap<string, PatchLine[]>;

/** The hunks the reviewer already holds are the only text searched; no blob is ever read. */
export function indexDiffLines(files: readonly DiffFileContract[]): DiffSearchIndex {
  return new Map(
    files.map((file) => [
      file.path,
      parsePatchHunks(file.patch).flatMap((hunk) =>
        // @git-diff-view drops a carriage return before rendering, so the DOM would not match it.
        hunk.lines.map((line) => ({ ...line, text: line.text.replace(/\r/g, "") })),
      ),
    ]),
  );
}

export function findDiffMatches(
  order: readonly DiffFileContract[],
  index: DiffSearchIndex,
  query: string,
): DiffSearchMatch[] {
  const matches: DiffSearchMatch[] = [];
  for (const file of order) {
    for (const line of index.get(file.path) ?? []) {
      occurrenceOffsets(line.text, query).forEach((_, occurrence) => {
        matches.push({ path: file.path, oldLine: line.oldLine, newLine: line.newLine, occurrence });
      });
    }
  }
  return matches;
}

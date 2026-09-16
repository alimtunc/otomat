import {
  parsePatchHunks,
  patchPreamble,
  type ChangeSelection,
  type PatchHunk,
} from "@otomat/domain";

import { SourceControlError } from "./errors.js";

type LineSelection = Extract<ChangeSelection, { kind: "lines" }>;

/** The hunk with only the picked lines still changing: an unpicked change of the side the patch applies to stays as context, the other side drops. */
function selectHunkLines(
  hunk: PatchHunk,
  selection: LineSelection,
  reverse: boolean,
): string[] | null {
  const [header = "", ...rawLines] = hunk.text.split("\n");
  let position = 0;
  let changed = false;
  let kept = false;
  const body: string[] = [];
  for (const line of rawLines) {
    if (line === "") continue;
    const prefix = line[0];
    if (prefix === "\\") {
      if (kept) body.push(line);
      continue;
    }
    const parsed = hunk.lines[position++];
    if (parsed === undefined)
      throw new SourceControlError("selection_unavailable", "This patch could not be selected.");
    const lineNumber = selection.side === "old" ? parsed.oldLine : parsed.newLine;
    const picked =
      lineNumber !== null && lineNumber >= selection.start && lineNumber <= selection.end;
    kept = true;
    if (prefix !== "+" && prefix !== "-") body.push(line);
    else if (picked) {
      body.push(line);
      changed = true;
    } else if (prefix === (reverse ? "+" : "-")) body.push(` ${line.slice(1)}`);
    else kept = false;
  }
  return changed ? [header, ...body] : null;
}

export function selectedPatch(patch: string, selection: ChangeSelection, reverse: boolean): string {
  const hunks = parsePatchHunks(patch);
  if (hunks.length === 0)
    throw new SourceControlError("selection_unavailable", "This change has no selectable text.");
  // Mode lines are left to the whole-file action, and `index` blob ids would not describe a partial result.
  const headers = patchPreamble(patch).filter(
    (line) => !/^(index |old mode |new mode )/.test(line),
  );
  const selected = hunks.flatMap((hunk, index) => {
    if (selection.kind === "hunk")
      return selection.index === index ? hunk.text.split("\n").filter(Boolean) : [];
    return selectHunkLines(hunk, selection, reverse) ?? [];
  });
  if (selected.length === 0)
    throw new SourceControlError(
      "selection_unavailable",
      "Select changed lines or a change block.",
    );
  return [...headers, ...selected, ""].join("\n");
}

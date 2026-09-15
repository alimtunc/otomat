import { parsePatchHunks, type ChangeSelection } from "@otomat/domain";

import { SourceControlError } from "./errors.js";

export function selectedPatch(patch: string, selection: ChangeSelection, reverse: boolean): string {
  const lines = patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@ "));
  if (firstHunk < 0)
    throw new SourceControlError("selection_unavailable", "This change has no selectable text.");
  const headers = lines
    .slice(0, firstHunk)
    .filter((line) => !/^(index |old mode |new mode )/.test(line));
  const hunks = parsePatchHunks(patch);
  const selected: string[] = [];
  for (const [index, hunk] of hunks.entries()) {
    if (selection.kind === "hunk") {
      if (selection.index === index) selected.push(...hunk.text.split("\n").filter(Boolean));
      continue;
    }
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
      if (prefix === "+" || prefix === "-") {
        if (picked) {
          body.push(line);
          changed = true;
        } else if (prefix === (reverse ? "+" : "-")) body.push(` ${line.slice(1)}`);
        else kept = false;
      } else body.push(line);
    }
    if (changed) selected.push(header, ...body);
  }
  if (selected.length === 0)
    throw new SourceControlError(
      "selection_unavailable",
      "Select changed lines or a change block.",
    );
  return [...headers, ...selected, ""].join("\n");
}

/** A fence the stream has not closed yet. The renderer labels that block as still
    arriving, which no Markdown compiler can tell us: it sees a finished document. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function openFenceBody(source: string): string | null {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let marker: string | null = null;
  let start = 0;
  for (const [index, line] of lines.entries()) {
    const fence = FENCE.exec(line)?.[1];
    if (fence === undefined) continue;
    if (marker === null) {
      marker = fence;
      start = index + 1;
      continue;
    }
    if (fence[0] === marker[0] && fence.length >= marker.length) marker = null;
  }
  return marker === null ? null : lines.slice(start).join("\n");
}

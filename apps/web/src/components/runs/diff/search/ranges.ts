interface TextSpan {
  node: Text;
  start: number;
  end: number;
}

function textSpans(root: Node): TextSpan[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const spans: TextSpan[] = [];
  let offset = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text) || node.data.length === 0) continue;
    const end = offset + node.data.length;
    spans.push({ node, start: offset, end });
    offset = end;
  }
  return spans;
}

function boundarySpan(
  spans: readonly TextSpan[],
  position: number,
  endBoundary: boolean,
): TextSpan | null {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const span = spans[middle];
    if (span === undefined) return null;
    const precedes = endBoundary ? span.end < position : span.end <= position;
    if (precedes) low = middle + 1;
    else high = middle;
  }
  const span = spans[low];
  if (span === undefined || (endBoundary ? position <= span.start : position < span.start)) {
    return null;
  }
  return span;
}

function rangeAt(spans: readonly TextSpan[], start: number, length: number): Range | null {
  const finish = start + length;
  const first = boundarySpan(spans, start, false);
  const last = boundarySpan(spans, finish, true);
  if (first === null || last === null) return null;
  const range = document.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, finish - last.start);
  return range;
}

/** Offsets come from hunk text; ranges only project them through syntax-highlighted text nodes. */
export function rangesAtOffsets(
  root: HTMLElement,
  offsets: readonly number[],
  length: number,
): (Range | null)[] {
  if (length === 0) return [];
  const spans = textSpans(root);
  return offsets.map((offset) => rangeAt(spans, offset, length));
}

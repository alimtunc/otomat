import { occurrenceOffsets } from "@web/components/runs/diff/search/occurrences";

function textNodes(root: Node): Text[] {
  const found: Text[] = [];
  for (const child of root.childNodes) {
    if (child instanceof Text) found.push(child);
    else found.push(...textNodes(child));
  }
  return found;
}

function rangeAt(nodes: readonly Text[], start: number, length: number): Range {
  const range = document.createRange();
  const finish = start + length;
  let offset = 0;
  for (const node of nodes) {
    const end = offset + node.data.length;
    if (start >= offset && start < end) range.setStart(node, start - offset);
    if (finish > offset && finish <= end) {
      range.setEnd(node, finish - offset);
      break;
    }
    offset = end;
  }
  return range;
}

/** Ranges span the element's text nodes: syntax highlighting splits a word across sibling spans. */
export function occurrenceRanges(root: HTMLElement, needle: string): Range[] {
  const nodes = textNodes(root);
  const text = nodes.map((node) => node.data).join("");
  return occurrenceOffsets(text, needle).map((at) => rangeAt(nodes, at, needle.length));
}

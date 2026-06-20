import { closeSync, fstatSync, openSync, readSync } from "node:fs";

const NEWLINE = 0x0a;

/**
 * Reads bytes appended after `offset`, returning every whole `\n`-terminated
 * line (blank lines included, so the returned count equals the newline count and
 * stays aligned with `byteOffsetForLine`). A torn final line (a partial write
 * with no newline yet) is left unread until it is completed.
 */
export function readCompleteLinesFrom(
  path: string,
  offset: number,
): { lines: string[]; consumedBytes: number } {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    if (size <= offset) return { lines: [], consumedBytes: 0 };

    const length = size - offset;
    const buffer = Buffer.allocUnsafe(length);
    const bytesRead = readSync(fd, buffer, 0, length, offset);

    const lastNewline = buffer.lastIndexOf(NEWLINE, bytesRead - 1);
    if (lastNewline === -1) return { lines: [], consumedBytes: 0 };

    const consumedBytes = lastNewline + 1;
    const lines = buffer.toString("utf8", 0, consumedBytes).split("\n");
    lines.pop(); // drop the trailing "" after the final newline; keep interior blanks
    return { lines, consumedBytes };
  } finally {
    closeSync(fd);
  }
}

/**
 * Byte offset at the start of line `n` (0-based) — just past the n-th `\n`. Used
 * to resume a tail after restart from the line count the DB already holds. If the
 * file has fewer than `n` complete lines, returns its current size.
 */
export function byteOffsetForLine(path: string, n: number): number {
  if (n <= 0) return 0;
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    if (size === 0) return 0;

    const buffer = Buffer.allocUnsafe(size);
    const bytesRead = readSync(fd, buffer, 0, size, 0);

    let seen = 0;
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === NEWLINE) {
        seen += 1;
        if (seen === n) return i + 1;
      }
    }
    return bytesRead;
  } finally {
    closeSync(fd);
  }
}

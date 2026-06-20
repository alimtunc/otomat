import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { byteOffsetForLine, readCompleteLinesFrom } from "./tail-source.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-tailsrc-"));
  path = join(dir, "events.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("tail-source", () => {
  it("returns only whole newline-terminated lines and leaves a torn line unread", () => {
    writeFileSync(path, "a\nb\n{partial");
    const { lines, consumedBytes } = readCompleteLinesFrom(path, 0);

    expect(lines).toEqual(["a", "b"]);
    expect(consumedBytes).toBe(4); // "a\nb\n", the partial tail stays unread
  });

  it("reads only bytes after the given offset", () => {
    writeFileSync(path, "a\nb\nc\n");
    expect(readCompleteLinesFrom(path, 4).lines).toEqual(["c"]);
  });

  it("keeps an interior blank line so the line count matches the newline count", () => {
    writeFileSync(path, "a\n\nb\n");
    const { lines, consumedBytes } = readCompleteLinesFrom(path, 0);
    expect(lines).toEqual(["a", "", "b"]);
    expect(consumedBytes).toBe(5);
  });

  it("byteOffsetForLine points just past the n-th newline", () => {
    writeFileSync(path, "aa\nbb\ncc\n");
    expect(byteOffsetForLine(path, 0)).toBe(0);
    expect(byteOffsetForLine(path, 1)).toBe(3);
    expect(byteOffsetForLine(path, 2)).toBe(6);
    expect(byteOffsetForLine(path, 3)).toBe(9);
  });

  it("byteOffsetForLine returns file size when fewer lines exist", () => {
    writeFileSync(path, "aa\nbb\n");
    expect(byteOffsetForLine(path, 5)).toBe(6);
  });
});

import { readScoped, writeScoped } from "@web/lib/storage";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

const KEY = "otomat.test-views";
const parse = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map(String) : []);

describe("scoped storage", () => {
  it("keeps one project's value out of another's", () => {
    const storage = memoryStorage();
    writeScoped(KEY, "project-1", ["mine"], storage);
    writeScoped(KEY, "project-2", ["theirs"], storage);
    expect(readScoped(KEY, "project-1", parse, storage)).toEqual(["mine"]);
    expect(readScoped(KEY, "project-2", parse, storage)).toEqual(["theirs"]);
    expect(readScoped(KEY, "project-3", parse, storage)).toEqual([]);
  });

  it("replaces one project's bucket without touching the others", () => {
    const storage = memoryStorage();
    writeScoped(KEY, "project-1", ["mine"], storage);
    writeScoped(KEY, "project-2", ["theirs"], storage);
    writeScoped(KEY, "project-1", [], storage);
    expect(readScoped(KEY, "project-1", parse, storage)).toEqual([]);
    expect(readScoped(KEY, "project-2", parse, storage)).toEqual(["theirs"]);
  });

  it("falls back to the parsed default when the entry is missing or corrupt", () => {
    const storage = memoryStorage();
    expect(readScoped(KEY, "project-1", parse, storage)).toEqual([]);
    storage.setItem(KEY, "{not json");
    expect(readScoped(KEY, "project-1", parse, storage)).toEqual([]);
    storage.setItem(KEY, '"a string"');
    expect(readScoped(KEY, "project-1", parse, storage)).toEqual([]);
  });

  it("survives a storage that refuses to answer", () => {
    expect(readScoped(KEY, "project-1", parse, null)).toEqual([]);
    expect(() => writeScoped(KEY, "project-1", ["mine"], null)).not.toThrow();
  });
});

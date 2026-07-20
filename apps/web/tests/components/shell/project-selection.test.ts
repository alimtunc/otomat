import {
  readSelectedProjectId,
  resolveSelectedProjectId,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("project selection", () => {
  it("defaults to the first available project when no preference is stored", () => {
    expect(
      resolveSelectedProjectId(
        [
          { id: "local-default", name: "Local workspace" },
          { id: "other", name: "Other workspace" },
        ],
        undefined,
      ),
    ).toBe("local-default");
  });

  it("keeps a valid stored selection and falls back when it disappears", () => {
    const projects = [
      { id: "local-default", name: "Local workspace" },
      { id: "other", name: "Other workspace" },
    ];

    expect(resolveSelectedProjectId(projects, "other")).toBe("other");
    expect(resolveSelectedProjectId(projects, "missing")).toBe("local-default");
  });

  it("round-trips the selected id through storage for navigation remounts", () => {
    const storage = memoryStorage();

    writeSelectedProjectId("other", storage);

    expect(readSelectedProjectId(storage)).toBe("other");
  });

  it("degrades to no preference when storage is unavailable", () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error("storage denied");
      },
      setItem: (): void => {
        throw new Error("storage denied");
      },
    };

    expect(readSelectedProjectId(throwing)).toBeUndefined();
    expect(() => writeSelectedProjectId("other", throwing)).not.toThrow();
  });
});

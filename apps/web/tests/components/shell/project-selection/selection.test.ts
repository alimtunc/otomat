import {
  readSelectedProjectId,
  resolveSelectedProjectId,
  writeSelectedProjectId,
} from "@web/components/shell/project-selection/selection";
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

    writeSelectedProjectId("local", "other", storage);

    expect(readSelectedProjectId("local", storage)).toBe("other");
  });

  it("keeps one selection per host, so returning to a host reopens its own project", () => {
    const storage = memoryStorage();

    writeSelectedProjectId("local", "local-default", storage);
    writeSelectedProjectId("remote", "remote-default", storage);

    expect(readSelectedProjectId("local", storage)).toBe("local-default");
    expect(readSelectedProjectId("remote", storage)).toBe("remote-default");
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

    expect(readSelectedProjectId("local", throwing)).toBeUndefined();
    expect(() => writeSelectedProjectId("local", "other", throwing)).not.toThrow();
  });
});

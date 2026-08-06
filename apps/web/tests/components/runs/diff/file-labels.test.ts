import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { describe, expect, it } from "vitest";

function names(path: string, oldPath: string | null = null) {
  return diffFileLabels({ path, old_path: oldPath });
}

describe("diff file row labels", () => {
  it("puts the basename first and the folder in the ellipsizable slot", () => {
    const labels = names("apps/web/src/components/runs/diff/files/card.tsx");
    expect(labels.name).toBe("card.tsx");
    expect(labels.directory).toBe("apps/web/src/components/runs/diff/files");
    expect(labels.move).toBeNull();
  });

  it("keeps the whole path recoverable however deep it is", () => {
    const path = `${"very-long-segment/".repeat(12)}deeply-nested-module-name.ts`;
    const labels = names(path);
    expect(labels.name).toBe("deeply-nested-module-name.ts");
    expect(labels.full).toBe(path);
    expect(labels.directory.length).toBeGreaterThan(labels.name.length);
  });

  it("has no folder to show at the repository root", () => {
    expect(names("AGENTS.md").directory).toBe("");
  });

  it("shows a renamed basename as old → new", () => {
    const labels = names("src/reviewer.ts", "src/review.ts");
    expect(labels.name).toBe("review.ts → reviewer.ts");
    expect(labels.move).toBeNull();
    expect(labels.full).toBe("src/review.ts → src/reviewer.ts");
  });

  it("shows a move as oldDir → newDir and keeps the basename intact", () => {
    const labels = names("apps/web/src/card.tsx", "packages/ui/src/card.tsx");
    expect(labels.name).toBe("card.tsx");
    expect(labels.move).toBe("packages/ui/src → apps/web/src");
  });

  it("reports both halves when a rename moves and renames at once", () => {
    const labels = names("apps/web/src/row.tsx", "packages/ui/src/line.tsx");
    expect(labels.name).toBe("line.tsx → row.tsx");
    expect(labels.move).toBe("packages/ui/src → apps/web/src");
    expect(labels.full).toBe("packages/ui/src/line.tsx → apps/web/src/row.tsx");
  });

  it("names the repository root when a rename crosses it", () => {
    expect(names("src/main.ts", "main.ts").move).toBe("/ → src");
  });

  it("treats an unchanged old path as no rename at all", () => {
    const labels = names("src/main.ts", "src/main.ts");
    expect(labels.name).toBe("main.ts");
    expect(labels.move).toBeNull();
    expect(labels.full).toBe("src/main.ts");
  });
});

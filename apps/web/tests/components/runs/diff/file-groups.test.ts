import { classifyDiffFile, groupDiffFiles } from "@web/components/runs/diff/files/group";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";

describe("diff file classification", () => {
  it.each([
    ["apps/web/src/components/runs/diff/files/row.tsx", "implementation"],
    ["packages/domain/src/index.ts", "implementation"],
    ["apps/web/src/styles.css", "implementation"],
    ["packages/db/migrations/0001_init.sql", "implementation"],
    ["apps/web/tests/components/runs/diff/prefs.test.ts", "tests"],
    ["apps/web/src/__tests__/row.ts", "tests"],
    ["apps/web/src/row.spec.tsx", "tests"],
    ["e2e/login.ts", "tests"],
    ["internal/store_test.go", "tests"],
    ["tests/support/mount.ts", "tests"],
    ["package.json", "config"],
    ["pnpm-lock.yaml", "config"],
    [".gitignore", "config"],
    [".github/workflows/ci.yml", "config"],
    ["apps/web/vite.config.ts", "config"],
    ["Dockerfile", "config"],
    ["scripts/release.sh", "config"],
    ["README.md", "docs"],
    ["docs/ai/codebase-map.md", "docs"],
    ["LICENSE", "docs"],
    ["docs/design/tokens.txt", "docs"],
    ["apps/web/public/logo.svg", "assets"],
    ["packages/ui/src/fonts/inter.woff2", "assets"],
    ["apps/desktop/build/icon.icns", "assets"],
    ["SPEC.md", "docs"],
    ["docs/specs/overview.md", "docs"],
    ["docs/__tests__/render.ts", "tests"],
    ["packages/docs/src/tests/helper.ts", "tests"],
    ["apps/web/tests/fixtures/payload.txt", "tests"],
    ["notes.test.txt", "tests"],
    [".github/assets/logo.png", "assets"],
    ["fixtures/usage.csv", "other"],
    ["bin/otomat", "other"],
  ])("files %s under %s", (path, type) => {
    expect(classifyDiffFile(path)).toBe(type);
  });

  it("keeps a name that merely contains a group word out of that group", () => {
    expect(classifyDiffFile("apps/web/src/lib/latest.ts")).toBe("implementation");
    expect(classifyDiffFile("apps/web/src/lib/manifest.ts")).toBe("implementation");
    expect(classifyDiffFile("packages/ui/src/spectrum.ts")).toBe("implementation");
  });
});

describe("diff file grouping", () => {
  const files = [
    diffFile({ path: "docs/guide.md", additions: 4, deletions: 1 }),
    diffFile({ path: "apps/web/src/b.ts", additions: 2, deletions: 3 }),
    diffFile({ path: "apps/web/src/a.ts", additions: 10, deletions: 0 }),
    diffFile({ path: "apps/web/tests/a.test.ts", additions: 5, deletions: 2 }),
  ];

  it("drops empty groups and keeps the canonical group order", () => {
    expect(groupDiffFiles(files).map((group) => group.label)).toEqual([
      "Implementation",
      "Tests",
      "Documentation",
    ]);
  });

  it("totals the changes of each group and counts its files", () => {
    const [implementation] = groupDiffFiles(files);

    expect(implementation.files).toHaveLength(2);
    expect(implementation.additions).toBe(12);
    expect(implementation.deletions).toBe(3);
  });

  it("keeps the incoming order inside a group, so the chosen sort survives", () => {
    const [implementation] = groupDiffFiles(files);

    expect(implementation.files.map((file) => file.path)).toEqual([
      "apps/web/src/b.ts",
      "apps/web/src/a.ts",
    ]);
  });

  it("classifies every file exactly once", () => {
    const grouped = groupDiffFiles(files).flatMap((group) => group.files.map((file) => file.path));

    expect(grouped.toSorted()).toEqual(files.map((file) => file.path).toSorted());
  });
});

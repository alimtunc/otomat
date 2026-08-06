import {
  buildDiffFileTree,
  expandAncestors,
  visibleTreeRows,
  type DiffTreeNode,
} from "@web/components/runs/diff/files/tree.utils";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";

function label(node: DiffTreeNode): string {
  return node.kind === "directory" ? `${node.label}/` : node.file.path;
}

function rowLabels(nodes: readonly DiffTreeNode[], collapsed: string[] = []) {
  return visibleTreeRows(nodes, new Set(collapsed)).map(
    ({ node, depth }) => `${"  ".repeat(depth)}${label(node)}`,
  );
}

describe("diff file tree", () => {
  it("nests files under the folders they actually live in", () => {
    const nodes = buildDiffFileTree([
      diffFile({ path: "src/a.ts" }),
      diffFile({ path: "src/b.ts" }),
      diffFile({ path: "README.md" }),
    ]);

    expect(rowLabels(nodes)).toEqual(["README.md", "src/", "  src/a.ts", "  src/b.ts"]);
  });

  it("shows a single-child folder run as one compacted row", () => {
    const nodes = buildDiffFileTree([diffFile({ path: "apps/web/src/main.tsx" })]);

    expect(rowLabels(nodes)).toEqual(["apps/web/src/", "  apps/web/src/main.tsx"]);
  });

  it("stops compacting where a folder branches", () => {
    const nodes = buildDiffFileTree([
      diffFile({ path: "apps/web/main.tsx" }),
      diffFile({ path: "apps/desktop/main.ts" }),
    ]);

    expect(rowLabels(nodes)).toEqual([
      "apps/",
      "  desktop/",
      "    apps/desktop/main.ts",
      "  web/",
      "    apps/web/main.tsx",
    ]);
  });

  it("orders folders and files the same way whatever order git listed them", () => {
    const paths = ["src/z.ts", "docs/guide.md", "src/a.ts", "AGENTS.md", "src/nested/deep.ts"];
    const forward = rowLabels(buildDiffFileTree(paths.map((path) => diffFile({ path }))));
    const reversed = rowLabels(
      buildDiffFileTree(paths.toReversed().map((path) => diffFile({ path }))),
    );

    expect(forward).toEqual(reversed);
    expect(forward).toEqual([
      "AGENTS.md",
      "docs/",
      "  docs/guide.md",
      "src/",
      "  src/a.ts",
      "  nested/",
      "    src/nested/deep.ts",
      "  src/z.ts",
    ]);
  });

  it("hides the subtree of a collapsed folder", () => {
    const nodes = buildDiffFileTree([
      diffFile({ path: "src/a.ts" }),
      diffFile({ path: "docs/guide.md" }),
    ]);

    expect(rowLabels(nodes, ["src"])).toEqual(["docs/", "  docs/guide.md", "src/"]);
    expect(visibleTreeRows(nodes, new Set(["src"]))[2].expanded).toBe(false);
  });

  it("keeps a compacted folder run collapsed on its deepest path", () => {
    const nodes = buildDiffFileTree([
      diffFile({ path: "src/deep/a.ts" }),
      diffFile({ path: "docs/guide.md" }),
    ]);

    expect(rowLabels(nodes, ["src/deep"])).toEqual(["docs/", "  docs/guide.md", "src/deep/"]);
  });
});

describe("expandAncestors", () => {
  it("reopens the folders hiding a path so navigation never lands out of sight", () => {
    const reopened = expandAncestors(new Set(["src/deep", "docs"]), "src/deep/a.ts");

    expect([...reopened]).toEqual(["docs"]);
  });

  it("leaves a folder that merely shares a name prefix collapsed", () => {
    const collapsed = new Set(["src/deep"]);

    expect(expandAncestors(collapsed, "src/deeper/a.ts")).toBe(collapsed);
  });

  it("returns the same set when nothing was hiding the path, so state does not churn", () => {
    const collapsed = new Set(["docs"]);

    expect(expandAncestors(collapsed, "src/a.ts")).toBe(collapsed);
  });
});

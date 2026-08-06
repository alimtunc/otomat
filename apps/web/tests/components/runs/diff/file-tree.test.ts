import type { DiffFileContract } from "@otomat/domain";
import {
  buildDiffFileTree,
  visibleTreeRows,
  type DiffTreeNode,
} from "@web/components/runs/diff/files/tree.utils";
import { describe, expect, it } from "vitest";

function file(path: string): DiffFileContract {
  return {
    path,
    old_path: null,
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: "",
    sha: `sha-${path}`,
  };
}

function label(node: DiffTreeNode): string {
  return node.kind === "directory" ? `${node.label}/` : node.file.path;
}

function rowLabels(nodes: readonly DiffTreeNode[], collapsed: string[], active: string | null) {
  return visibleTreeRows(nodes, new Set(collapsed), active).map(
    ({ node, depth }) => `${"  ".repeat(depth)}${label(node)}`,
  );
}

describe("diff file tree", () => {
  it("nests files under the folders they actually live in", () => {
    const nodes = buildDiffFileTree([file("src/a.ts"), file("src/b.ts"), file("README.md")]);

    expect(rowLabels(nodes, [], null)).toEqual(["README.md", "src/", "  src/a.ts", "  src/b.ts"]);
  });

  it("shows a single-child folder run as one compacted row", () => {
    const nodes = buildDiffFileTree([file("apps/web/src/main.tsx")]);

    expect(rowLabels(nodes, [], null)).toEqual(["apps/web/src/", "  apps/web/src/main.tsx"]);
  });

  it("stops compacting where a folder branches", () => {
    const nodes = buildDiffFileTree([file("apps/web/main.tsx"), file("apps/desktop/main.ts")]);

    expect(rowLabels(nodes, [], null)).toEqual([
      "apps/",
      "  desktop/",
      "    apps/desktop/main.ts",
      "  web/",
      "    apps/web/main.tsx",
    ]);
  });

  it("orders folders and files the same way whatever order git listed them", () => {
    const paths = ["src/z.ts", "docs/guide.md", "src/a.ts", "AGENTS.md", "src/nested/deep.ts"];
    const forward = rowLabels(buildDiffFileTree(paths.map(file)), [], null);
    const reversed = rowLabels(buildDiffFileTree(paths.toReversed().map(file)), [], null);

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
    const nodes = buildDiffFileTree([file("src/a.ts"), file("docs/guide.md")]);

    expect(rowLabels(nodes, ["src"], null)).toEqual(["docs/", "  docs/guide.md", "src/"]);
    expect(visibleTreeRows(nodes, new Set(["src"]), null)[2].expanded).toBe(false);
  });

  it("reopens the folders holding the active file so navigation never lands out of sight", () => {
    const nodes = buildDiffFileTree([file("src/deep/a.ts"), file("docs/guide.md")]);

    expect(rowLabels(nodes, ["src/deep"], "src/deep/a.ts")).toEqual([
      "docs/",
      "  docs/guide.md",
      "src/deep/",
      "  src/deep/a.ts",
    ]);
  });
});

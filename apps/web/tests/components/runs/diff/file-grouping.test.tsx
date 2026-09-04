// @vitest-environment happy-dom
import { DiffFileBrowser } from "@web/components/runs/diff/files/browser";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { orderDiffFiles } from "@web/components/runs/diff/visible-files";
import { act, useState } from "react";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";
import { pressKey } from "#support/dom-events";
import { mount } from "#support/mount";

const FILES = [
  diffFile({ path: "apps/web/src/components/runs/diff/files/row.tsx", additions: 6, deletions: 2 }),
  diffFile({
    path: "apps/web/src/components/runs/diff/files/list.tsx",
    additions: 3,
    deletions: 1,
  }),
  diffFile({
    path: "apps/web/tests/components/runs/diff/row.test.tsx",
    additions: 9,
    deletions: 0,
  }),
  diffFile({ path: "docs/ai/codebase-map.md", additions: 4, deletions: 4 }),
];

const ORDERED = orderDiffFiles(FILES, "path", "type");

function Harness({ mode = "files" }: { mode?: DiffBrowserMode }) {
  const [activePath, setActivePath] = useState<string | null>(null);

  useDiffKeyboardNav({
    enabled: true,
    files: ORDERED,
    activePath,
    onJumpToFile: (next) => setActivePath(next.path),
    onToggleReviewed: () => {},
    onExit: () => {},
  });

  return (
    <DiffFileBrowser
      files={ORDERED}
      mode={mode}
      grouping="type"
      activePath={activePath}
      reviewedPaths={new Set()}
      onSelect={(next) => setActivePath(next.path)}
    />
  );
}

function groupHeader(container: HTMLElement, label: string): HTMLButtonElement {
  const header = [...container.querySelectorAll<HTMLButtonElement>("section > button")].find(
    (button) => button.textContent?.startsWith(label) === true,
  );
  if (header === undefined) throw new Error(`no group header for ${label}`);
  return header;
}

function fileRow(container: HTMLElement, path: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`button[title="${path}"]`);
}

describe("file-type grouping", () => {
  it("orders the files by group, keeping the chosen sort inside each one", () => {
    expect(ORDERED.map((file) => file.path)).toEqual([
      "apps/web/src/components/runs/diff/files/list.tsx",
      "apps/web/src/components/runs/diff/files/row.tsx",
      "apps/web/tests/components/runs/diff/row.test.tsx",
      "docs/ai/codebase-map.md",
    ]);
  });

  it("heads each group with its file count and change totals", async () => {
    const { container, cleanup } = await mount(<Harness />);

    expect(groupHeader(container, "Implementation").textContent).toBe("Implementation2+9-3");
    expect(groupHeader(container, "Tests").textContent).toBe("Tests1+9-0");
    expect(groupHeader(container, "Documentation").textContent).toBe("Documentation1+4-4");
    await cleanup();
  });

  it("leaves out the groups no changed file belongs to", async () => {
    const { container, cleanup } = await mount(<Harness />);

    const labels = [...container.querySelectorAll("section > button")].map(
      (header) => header.querySelector("span")?.textContent,
    );

    expect(labels).toEqual(["Implementation", "Tests", "Documentation"]);
    await cleanup();
  });

  it("folds a group away and back without losing the other groups", async () => {
    const { container, cleanup } = await mount(<Harness />);
    const path = "docs/ai/codebase-map.md";

    await act(async () => {
      groupHeader(container, "Documentation").click();
    });

    expect(groupHeader(container, "Documentation").getAttribute("aria-expanded")).toBe("false");
    expect(fileRow(container, path)).toBeNull();
    expect(fileRow(container, "apps/web/src/components/runs/diff/files/row.tsx")).not.toBeNull();

    await act(async () => {
      groupHeader(container, "Documentation").click();
    });

    expect(fileRow(container, path)).not.toBeNull();
    await cleanup();
  });

  it("reopens a folded group when navigation moves into it", async () => {
    const { container, cleanup } = await mount(<Harness />);

    await act(async () => {
      groupHeader(container, "Tests").click();
    });
    expect(groupHeader(container, "Tests").getAttribute("aria-expanded")).toBe("false");

    await pressKey("j");
    await pressKey("j");
    await pressKey("j");

    expect(groupHeader(container, "Tests").getAttribute("aria-expanded")).toBe("true");
    const revealed = fileRow(container, "apps/web/tests/components/runs/diff/row.test.tsx");
    expect(revealed?.getAttribute("aria-current")).toBe("true");
    await cleanup();
  });

  it("keeps the folder rows of tree mode inside each group", async () => {
    const { container, cleanup } = await mount(<Harness mode="tree" />);

    expect(groupHeader(container, "Documentation").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('button[title="docs/ai"]')).not.toBeNull();
    expect(fileRow(container, "docs/ai/codebase-map.md")).not.toBeNull();
    await cleanup();
  });
});

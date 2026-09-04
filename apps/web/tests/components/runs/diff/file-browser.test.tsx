// @vitest-environment happy-dom
import { DiffFileBrowser } from "@web/components/runs/diff/files/browser";
import type { DiffBrowserMode } from "@web/components/runs/diff/prefs/prefs";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { act, useState } from "react";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";
import { pressKey } from "#support/dom-events";
import { mount } from "#support/mount";

const FILES = [
  diffFile({ path: "apps/web/src/components/runs/diff/files/card.tsx" }),
  diffFile({
    path: "apps/web/src/components/runs/diff/files/row.tsx",
    old_path: "packages/ui/src/line.tsx",
    status: "renamed",
  }),
  diffFile({ path: "docs/ai/codebase-map.md" }),
];

function Harness({ initialMode }: { initialMode: DiffBrowserMode }) {
  const [mode, setMode] = useState<DiffBrowserMode>(initialMode);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set<string>());

  useDiffKeyboardNav({
    enabled: true,
    files: FILES,
    activePath,
    onJumpToFile: (next) => setActivePath(next.path),
    onToggleReviewed: (path) => {
      const next = new Set(reviewed);
      if (!next.delete(path)) next.add(path);
      setReviewed(next);
    },
    onExit: () => {},
  });

  return (
    <div>
      <button
        type="button"
        data-testid="swap"
        onClick={() => setMode(mode === "tree" ? "files" : "tree")}
      >
        swap
      </button>
      <DiffFileBrowser
        files={FILES}
        mode={mode}
        grouping="none"
        activePath={activePath}
        reviewedPaths={reviewed}
        onSelect={(next) => setActivePath(next.path)}
      />
    </div>
  );
}

function fileRow(container: HTMLElement, fullPath: string): HTMLButtonElement {
  const row = container.querySelector<HTMLButtonElement>(`button[title="${fullPath}"]`);
  if (row === null) throw new Error(`no row for ${fullPath}`);
  return row;
}

describe("changed-file browser", () => {
  it("leads with the basename and keeps the folder as secondary detail", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="files" />);

    const row = fileRow(container, "docs/ai/codebase-map.md");
    const spans = [...row.querySelectorAll("span")].map((span) => span.textContent);

    expect(spans).toContain("codebase-map.md");
    expect(spans).toContain("docs/ai");
    await cleanup();
  });

  it("keeps the whole path reachable on hover for a deeply nested file", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="files" />);

    const path = "apps/web/src/components/runs/diff/files/card.tsx";
    expect(fileRow(container, path).title).toBe(path);
    await cleanup();
  });

  it("spells a rename out as old → new in both halves of the row", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="files" />);

    const row = fileRow(
      container,
      "packages/ui/src/line.tsx → apps/web/src/components/runs/diff/files/row.tsx",
    );

    expect(row.textContent).toContain("line.tsx → row.tsx");
    expect(row.textContent).toContain("packages/ui/src → apps/web/src/components/runs/diff/files");
    await cleanup();
  });

  it("renders folders as foldable rows in tree mode", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="tree" />);

    const folder = () => container.querySelector<HTMLButtonElement>('button[title="docs/ai"]');
    const opened = folder();
    if (opened === null) throw new Error("no folder row rendered");
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('button[title="docs/ai/codebase-map.md"]')).not.toBeNull();

    await act(async () => {
      opened.click();
    });

    expect(folder()?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('button[title="docs/ai/codebase-map.md"]')).toBeNull();
    await cleanup();
  });

  it("collapses a folder that holds the active file instead of ignoring the click", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="tree" />);
    const path = "docs/ai/codebase-map.md";

    await act(async () => {
      fileRow(container, path).click();
    });
    const folder = () => container.querySelector<HTMLButtonElement>('button[title="docs/ai"]');
    const opened = folder();
    if (opened === null) throw new Error("no folder row rendered");

    await act(async () => {
      opened.click();
    });

    expect(folder()?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(`button[title="${path}"]`)).toBeNull();
    await cleanup();
  });

  it("reopens a collapsed folder when navigation moves into it", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="tree" />);
    const folder = () => container.querySelector<HTMLButtonElement>('button[title="docs/ai"]');
    const opened = folder();
    if (opened === null) throw new Error("no folder row rendered");

    await act(async () => {
      opened.click();
    });
    expect(folder()?.getAttribute("aria-expanded")).toBe("false");

    await pressKey("j");
    await pressKey("j");
    await pressKey("j");

    expect(folder()?.getAttribute("aria-expanded")).toBe("true");
    const revealed = fileRow(container, "docs/ai/codebase-map.md");
    expect(revealed.getAttribute("aria-current")).toBe("true");
    await cleanup();
  });

  it("carries the active file and the reviewed marks across a mode change", async () => {
    const { container, cleanup } = await mount(<Harness initialMode="files" />);
    const path = "docs/ai/codebase-map.md";

    await act(async () => {
      fileRow(container, path).click();
    });
    await pressKey("v");

    expect(fileRow(container, path).getAttribute("aria-current")).toBe("true");
    expect(fileRow(container, path).querySelector('[aria-label="Reviewed"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="swap"]')?.click();
    });

    expect(fileRow(container, path).getAttribute("aria-current")).toBe("true");
    expect(fileRow(container, path).querySelector('[aria-label="Reviewed"]')).not.toBeNull();
    await cleanup();
  });

  it("keeps j and k stepping through files in either mode", async () => {
    for (const initialMode of ["files", "tree"] as const) {
      const { container, cleanup } = await mount(<Harness initialMode={initialMode} />);

      await pressKey("j");
      expect(fileRow(container, FILES[0].path).getAttribute("aria-current")).toBe("true");

      await pressKey("j");
      await pressKey("j");
      expect(fileRow(container, FILES[2].path).getAttribute("aria-current")).toBe("true");

      await pressKey("k");
      const renamed = fileRow(
        container,
        "packages/ui/src/line.tsx → apps/web/src/components/runs/diff/files/row.tsx",
      );
      expect(renamed.getAttribute("aria-current")).toBe("true");

      await cleanup();
    }
  });
});

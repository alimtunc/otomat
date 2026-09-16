// @vitest-environment happy-dom
import type { WorktreeFileEntry } from "@otomat/domain";
import { FileBrowser } from "@web/components/files/browser";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { diffFile } from "#support/diff-file";
import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const ENTRIES: WorktreeFileEntry[] = [
  { path: "README.md", kind: "file", size: 10 },
  { path: "src/app.ts", kind: "file", size: 20 },
  { path: "src/lib/util.ts", kind: "file", size: 30 },
  { path: "host-link", kind: "symlink", size: 0 },
];

function Harness({ initialPath = null }: { initialPath?: string | null }) {
  const [activePath, setActivePath] = useState<string | null>(initialPath);
  return <FileBrowser entries={ENTRIES} activePath={activePath} onSelect={setActivePath} />;
}

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("nav li button")].map((row) => row.textContent ?? "");
}

describe("FileBrowser", () => {
  it("colors changed files and collapsed ancestors, and opens deleted files in Changes", async () => {
    const onSelect = vi.fn();
    const mounted = await mount(
      <FileBrowser
        entries={ENTRIES}
        activePath={null}
        onSelect={onSelect}
        changes={{
          branch: "main",
          revision: "revision",
          conflicts: [],
          staged: [diffFile({ path: "src/app.ts", status: "added" })],
          unstaged: [
            diffFile({ path: "src/app.ts", status: "modified" }),
            diffFile({ path: "src/deleted.ts", status: "deleted" }),
          ],
        }}
      />,
    );
    const folder = mounted.container.querySelector<HTMLButtonElement>('button[title="src"]');
    expect(folder?.querySelector('[aria-label="Contains changes"]')?.className).toContain(
      "text-warning",
    );
    await act(async () => folder?.click());
    const added = mounted.container.querySelector('button[title="src/app.ts"]');
    expect(added?.querySelector('[aria-label="added"]')?.textContent).toBe("A");
    expect(added?.textContent).toContain("app.tsA");
    const deleted = mounted.container.querySelector<HTMLButtonElement>(
      'button[title="src/deleted.ts"]',
    );
    expect(deleted?.querySelector('[aria-label="deleted"]')?.textContent).toBe("D");
    expect(deleted?.querySelector(".line-through")).not.toBeNull();
    await act(async () => deleted?.click());
    expect(onSelect).toHaveBeenCalledWith("src/deleted.ts", true);
    await mounted.cleanup();
  });

  it("starts with every folder collapsed and opens one on click", async () => {
    const mounted = await mount(<Harness />);
    expect(rowNames(mounted.container)).toEqual(["src", "host-link", "README.md"]);
    expect(
      mounted.container.querySelector('button[title="host-link"] [title="symlink"]'),
    ).not.toBeNull();

    const folder = mounted.container.querySelector<HTMLButtonElement>('button[title="src"]');
    await act(async () => folder?.click());
    expect(rowNames(mounted.container)).toEqual(["src", "lib", "app.ts", "host-link", "README.md"]);
    await mounted.cleanup();
  });

  it("reveals the ancestors of the active file and marks it current", async () => {
    const mounted = await mount(<Harness initialPath="src/lib/util.ts" />);
    expect(rowNames(mounted.container)).toContain("util.ts");
    const current = mounted.container.querySelector('button[aria-current="true"]');
    expect(current?.getAttribute("title")).toBe("src/lib/util.ts");
    await mounted.cleanup();
  });

  it("filters by path and names an empty match", async () => {
    const mounted = await mount(<Harness />);
    const input = mounted.container.querySelector<HTMLInputElement>("input");
    if (input === null) throw new Error("filter input missing");
    await act(async () => setInputValue(input, "util"));
    expect(rowNames(mounted.container)).toEqual(["src/lib", "util.ts"]);

    await act(async () => setInputValue(input, "nothing-here"));
    expect(mounted.container.textContent).toContain("No file matches.");
    await mounted.cleanup();
  });

  it("navigates and folds folders with arrow keys and remembers their state", async () => {
    const props = {
      entries: ENTRIES,
      activePath: null,
      onSelect: () => undefined,
      scope: "keyboard-test",
    };
    const mounted = await mount(<FileBrowser {...props} />);
    const folder = mounted.container.querySelector<HTMLButtonElement>('button[title="src"]');
    if (folder === null) throw new Error("folder missing");
    folder.focus();
    await act(async () =>
      folder.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      folder.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
    );
    expect(document.activeElement?.getAttribute("title")).toBe("src/lib");
    await mounted.cleanup();
    const restored = await mount(<FileBrowser {...props} />);
    expect(
      restored.container.querySelector('button[title="src"]')?.getAttribute("aria-expanded"),
    ).toBe("true");
    await restored.cleanup();
    localStorage.removeItem("otomat.files.folders");
  });
});

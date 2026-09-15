// @vitest-environment happy-dom
import type { WorktreeFileEntry } from "@otomat/domain";
import { WorktreeFileBrowser } from "@web/components/runs/files/browser";
import { act, useState } from "react";
import { describe, expect, it } from "vitest";

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
  return <WorktreeFileBrowser entries={ENTRIES} activePath={activePath} onSelect={setActivePath} />;
}

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("nav li button")].map((row) => row.textContent ?? "");
}

describe("WorktreeFileBrowser", () => {
  it("starts with every folder collapsed and opens one on click", async () => {
    const mounted = await mount(<Harness />);
    expect(rowNames(mounted.container)).toEqual(["README.md", "host-linksymlink", "src"]);

    const folder = mounted.container.querySelector<HTMLButtonElement>('button[title="src"]');
    await act(async () => folder?.click());
    expect(rowNames(mounted.container)).toEqual([
      "README.md",
      "host-linksymlink",
      "src",
      "app.ts",
      "lib",
    ]);
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
});

// @vitest-environment happy-dom
import { DiffFileBrowser } from "@web/components/runs/diff/files/browser";
import type { DiffGroupingMode } from "@web/components/runs/diff/prefs/prefs";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { diffFile, reviewDiff } from "#support/diff-file";
import { setInputValue } from "#support/dom-events";
import { mount } from "#support/mount";

const DIFF = reviewDiff({
  files: [
    diffFile({ path: "src/components/Alpha.tsx" }),
    diffFile({ path: "tests/beta.test.ts" }),
    diffFile({ path: "src/current/Gamma.ts", old_path: "src/legacy/Gamma.ts" }),
  ],
  additions: 3,
});

function visibleFiles(container: HTMLElement): string[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Changed files"] button'),
  ]
    .map((button) => button.title)
    .filter((title) => title.endsWith(".ts") || title.endsWith(".tsx"));
}

function groupLabels(container: HTMLElement): (string | null | undefined)[] {
  return [...container.querySelectorAll("section > button")].map(
    (header) => header.querySelector("span")?.textContent,
  );
}

async function openBrowser(mode: "files" | "tree", grouping: DiffGroupingMode = "none") {
  const mounted = await mount(
    <DiffFileBrowser
      files={DIFF.files}
      mode={mode}
      grouping={grouping}
      activePath={null}
      reviewedPaths={new Set()}
      onSelect={() => {}}
    />,
  );
  const field = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="Filter changed files"]',
  );
  if (field === null) throw new Error("the file browser has no filter");
  return {
    ...mounted,
    type: async (value: string) => {
      await act(async () => setInputValue(field, value));
    },
  };
}

describe("filtering changed files", () => {
  for (const mode of ["files", "tree"] as const) {
    it(`filters ${mode} by path without changing case`, async () => {
      const view = await openBrowser(mode);

      await view.type("BETA");

      expect(visibleFiles(view.container)).toEqual(["tests/beta.test.ts"]);
      await view.cleanup();
    });
  }

  it("finds a rename by its previous path", async () => {
    const view = await openBrowser("files");

    await view.type("legacy");

    expect(visibleFiles(view.container)).toEqual(["src/legacy/Gamma.ts → src/current/Gamma.ts"]);
    await view.cleanup();
  });

  it("drops the groups a filter emptied and keeps the one it matched", async () => {
    const view = await openBrowser("files", "type");

    await view.type("beta");

    expect(visibleFiles(view.container)).toEqual(["tests/beta.test.ts"]);
    expect(groupLabels(view.container)).toEqual(["Tests"]);
    await view.cleanup();
  });

  it("states when no changed file matches", async () => {
    const view = await openBrowser("files");

    await view.type("nowhere");

    expect(visibleFiles(view.container)).toEqual([]);
    expect(view.container.textContent).toContain("No changed file matches.");
    await view.cleanup();
  });
});

// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { ThemeProvider, useTheme } from "@otomat/ui";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffFileCardProps } from "#support/diff-card";
import { stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch } from "#support/diff-file";
import { stubIntersectionObserver, type IntersectionStub } from "#support/intersection";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

function file(overrides: Partial<DiffFileContract> & { path: string }): DiffFileContract {
  return diffFile({ patch: diffPatch(overrides.path), ...overrides });
}

function Card({ entry }: { entry: DiffFileContract }) {
  const { toggleTheme } = useTheme();
  return (
    <div>
      <button type="button" data-testid="toggle-theme" onClick={toggleTheme}>
        toggle theme
      </button>
      <DiffFileCard {...diffFileCardProps({ file: entry })} />
    </div>
  );
}

function renderCard(entry: DiffFileContract) {
  return mountWithQuery(
    <ThemeProvider>
      <Card entry={entry} />
    </ThemeProvider>,
  );
}

let observer: IntersectionStub;

beforeEach(() => {
  observer = stubIntersectionObserver();
});

afterEach(() => {
  observer.restore();
});

describe("diff card syntax highlighting", () => {
  it("leaves an off-screen card uncoloured so a large diff does not pay for it up front", async () => {
    const { container, cleanup } = await renderCard(file({ path: "src/index.ts" }));

    expect(container.querySelector(".hljs-keyword")).toBeNull();
    await cleanup();
  });

  it("colours a TypeScript card once it reaches the viewport", async () => {
    const { container, cleanup } = await renderCard(file({ path: "src/index.ts" }));

    await act(async () => {
      observer.reveal();
    });

    const keywords = [...container.querySelectorAll(".hljs-keyword")].map(
      (node) => node.textContent,
    );
    expect(keywords).toContain("const");
    await cleanup();
  });

  it("shows an unknown extension as plain text instead of inventing a language", async () => {
    const entry = file({ path: "assets/thing.zzz" });
    const { container, cleanup } = await renderCard(entry);

    await act(async () => {
      observer.reveal();
    });

    expect(container.querySelector(".hljs-keyword")).toBeNull();
    expect(container.textContent).toContain("const answer = 42;");
    await cleanup();
  });

  it("keeps a rename readable, colouring each side by its own name", async () => {
    const entry = file({ path: "src/index.ts", old_path: "src/index.js", status: "renamed" });
    const { container, cleanup } = await renderCard(entry);

    await act(async () => {
      observer.reveal();
    });

    expect(container.textContent).toContain("src/index.js → src/index.ts");
    expect(container.querySelector(".hljs-keyword")).not.toBeNull();
    await cleanup();
  });

  it("follows the Otomat theme, so the palette stays readable in light and dark", async () => {
    const { container, cleanup } = await renderCard(file({ path: "src/index.ts" }));
    const wrapper = () => container.querySelector(".diff-tailwindcss-wrapper");

    await act(async () => {
      observer.reveal();
    });
    const before = wrapper()?.getAttribute("data-theme");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="toggle-theme"]')?.click();
    });

    const after = wrapper()?.getAttribute("data-theme");
    expect(new Set([before, after])).toEqual(new Set(["dark", "light"]));
    expect(container.querySelector(".hljs-keyword")).not.toBeNull();
    await cleanup();
  });

  it("says so plainly for a binary file rather than rendering an empty diff", async () => {
    const entry = file({ path: "assets/logo.png", binary: true, patch: "" });
    const { container, cleanup } = await renderCard(entry);

    await act(async () => {
      observer.reveal();
    });

    expect(container.textContent).toContain("Binary file — no textual diff.");
    await cleanup();
  });
});

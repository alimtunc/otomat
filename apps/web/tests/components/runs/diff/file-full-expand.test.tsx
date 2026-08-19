// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { DiffFileBlobsResponse } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { diffFileCardProps } from "#support/diff-card";
import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { diffFile } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

const WHOLE_FILE = ["line one", "line two changed", "line three", "line four", "line five"].join(
  "\n",
);

const getDiffFileBlobs = vi.fn<() => Promise<DiffFileBlobsResponse>>(async () => ({
  base_content: WHOLE_FILE,
  head_content: WHOLE_FILE,
}));

vi.mock("@web/api/client", () => ({
  daemon: { getDiffFileBlobs: () => getDiffFileBlobs() },
}));

const file = diffFile({ path: "src/index.ts", patch: MODIFIED_FILE_PATCH, sha: "file-sha" });

const cleanups: Array<() => Promise<void>> = [];

async function renderCard() {
  const { container, cleanup } = await mountWithQuery(
    <ThemeProvider>
      <DiffFileCard {...diffFileCardProps({ file })} />
    </ThemeProvider>,
  );
  cleanups.push(cleanup);
  const control = (prefix: string): HTMLButtonElement => {
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) =>
      (candidate.getAttribute("aria-label") ?? candidate.textContent ?? "").startsWith(prefix),
    );
    if (button === undefined) throw new Error(`no control starting with "${prefix}"`);
    return button;
  };
  return {
    container,
    control,
    click: async (prefix: string) => {
      await act(async () => {
        control(prefix).click();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
  };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
  getDiffFileBlobs.mockResolvedValue({ base_content: WHOLE_FILE, head_content: WHOLE_FILE });
});

describe("full-file expansion", () => {
  it("offers one header action and reads nothing until it is used", async () => {
    const card = await renderCard();

    expect(card.control("Expand full file").getAttribute("aria-pressed")).toBe("false");
    expect(getDiffFileBlobs).not.toHaveBeenCalled();
    expect(card.container.textContent).not.toContain("Load file");
  });

  it("loads and shows the whole file from that one action", async () => {
    const card = await renderCard();

    await card.click("Expand full file");

    expect(getDiffFileBlobs).toHaveBeenCalledTimes(1);
    expect(card.control("Show only the changes").getAttribute("aria-pressed")).toBe("true");
    expect(card.container.textContent).toContain("line five");
  });

  it("keeps the loaded file when the reader folds it back, and reads it once", async () => {
    const card = await renderCard();

    await card.click("Expand full file");
    await card.click("Show only the changes");
    expect(card.container.textContent).not.toContain("line five");

    await card.click("Expand full file");

    expect(card.container.textContent).toContain("line five");
    expect(getDiffFileBlobs).toHaveBeenCalledTimes(1);
  });

  it("states the daemon's refusal and lets the reader ask again", async () => {
    getDiffFileBlobs.mockRejectedValueOnce(
      new DaemonRequestError(413, "GET", "/api/runs/run-1/diff/file", { error: "file_too_large" }),
    );
    const card = await renderCard();

    await card.click("Expand full file");
    expect(card.container.textContent).toContain("This file is too large to load in full.");

    await card.click("Retry");

    expect(getDiffFileBlobs).toHaveBeenCalledTimes(2);
    expect(card.container.textContent).toContain("line five");
  });
});

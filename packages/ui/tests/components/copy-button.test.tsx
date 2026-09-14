// @vitest-environment happy-dom
import { CopyButton } from "@otomat/ui";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(async () => {
  await unmountAll();
  vi.restoreAllMocks();
});

it.each([false, true])(
  "identifies and copies the complete value, visible label: %s",
  async (showLabel) => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const container = await render(
      <CopyButton
        value="https://example.test/pull/2187"
        label="Copy pull request URL"
        showLabel={showLabel}
      />,
    );
    const button = container.querySelector("button");
    if (button === null) throw new Error("Missing copy button");
    await act(async () => button.focus());
    expect(button.getAttribute("aria-label")).toBe("Copy pull request URL");
    if (!showLabel) expect(document.body.textContent).toContain("Copy pull request URL");
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith("https://example.test/pull/2187");
    expect(button.getAttribute("data-status")).toBe("copied");
    expect(button.getAttribute("aria-label")).toBe("Copied");
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    await act(async () => button.click());
    expect(button.getAttribute("data-status")).toBe("error");
    expect(button.getAttribute("aria-label")).toBe("Copy failed");
  },
);

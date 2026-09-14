import { afterEach, beforeEach, vi } from "vitest";

function elementHeight(this: HTMLElement): number {
  if (this.tagName === "TR") return 40;
  if (this.tagName === "LI") return 140;
  return 600;
}

export function mockListViewport(): void {
  const restore: Array<() => void> = [];
  beforeEach(() => {
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(elementHeight);
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1200);
    restore.push(() => {
      height.mockRestore();
      width.mockRestore();
    });
  });
  afterEach(() => {
    for (const reset of restore.splice(0)) reset();
  });
}

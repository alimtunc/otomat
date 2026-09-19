// @vitest-environment happy-dom
import { Markdown } from "@otomat/ui";
import { afterEach, expect, it } from "vitest";

import { QR_HALF_BLOCKS, QR_MODULES } from "#test-support/qr";
import { render, unmountAll } from "#test-support/render";

afterEach(unmountAll);

const fenced = (body: string): string => `Scan it:\n\n\`\`\`text\n${body}\n\`\`\``;

it("renders a QR block as a square module grid with a quiet zone", async () => {
  const container = await render(<Markdown value={fenced(QR_HALF_BLOCKS)} />);
  const svg = container.querySelector('svg[role="img"]');
  const size = QR_MODULES.length + 8;

  expect(container.querySelector("pre")).toBeNull();
  expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${size} ${size}`);
  expect(svg?.getAttribute("aria-label")).toBe("QR code");
  expect(svg?.getAttribute("shape-rendering")).toBe("crispEdges");
  expect(svg?.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
  expect(svg?.querySelector("path")?.getAttribute("fill")).toBe("#000");
  expect(svg?.querySelector("path")?.getAttribute("d")).toContain("M4 4h1v1h-1z");
  expect(svg?.querySelector("path")?.getAttribute("d")).not.toContain("M0 0");
  expect(container.textContent).toContain("qr code");
});

it("scales down with its container without cropping or stretching", async () => {
  const container = await render(<Markdown value={fenced(QR_HALF_BLOCKS)} />);
  const svg = container.querySelector<SVGElement>('svg[role="img"]');

  expect(svg?.style.maxWidth).toBe(`${(QR_MODULES.length + 8) * 8}px`);
  expect(svg?.getAttribute("class")).toContain("w-full");
  expect(svg?.getAttribute("class")).toContain("h-auto");
  expect(svg?.getAttribute("height")).toBeNull();
  expect(svg?.closest(".overflow-auto")).toBeNull();
});

it("keeps the raw art one click away", async () => {
  const container = await render(<Markdown value={fenced(QR_HALF_BLOCKS)} />);

  expect(container.querySelector('button[aria-label="Copy code"]')).not.toBeNull();
});

it("leaves an ordinary code block untouched", async () => {
  const container = await render(<Markdown value={fenced('const branch = "main";')} />);

  expect(container.querySelector('svg[role="img"]')).toBeNull();
  expect(container.querySelector("pre")?.textContent).toBe('const branch = "main";');
  expect(container.textContent).toContain("text");
});

it("falls back to the code block while the art is still arriving", async () => {
  const partial = QR_HALF_BLOCKS.split("\n").slice(0, 9).join("\n");
  const container = await render(<Markdown value={`Scan it:\n\n\`\`\`\n${partial}`} />);

  expect(container.querySelector('svg[role="img"]')).toBeNull();
  expect(container.querySelector("pre")?.textContent).toBe(partial);
  expect(container.textContent).toContain("streaming");
});

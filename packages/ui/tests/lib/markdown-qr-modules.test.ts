import { expect, it } from "vitest";

import { QR_HALF_BLOCKS, QR_MODULES } from "#test-support/qr";
import { parseQrModules } from "#ui/lib/markdown/qr-modules";

const QUIET = 4;

const fullBlocks = (dark: string, light: string): string => {
  const margin = light.repeat(QR_MODULES.length + QUIET * 2);
  const body = QR_MODULES.map(
    (row) =>
      light.repeat(QUIET) + row.map((cell) => (cell ? dark : light)).join("") + light.repeat(QUIET),
  );
  return [...Array<string>(QUIET).fill(margin), ...body, ...Array<string>(QUIET).fill(margin)].join(
    "\n",
  );
};

it("recovers the generator's module matrix from half-block art", () => {
  expect(parseQrModules(QR_HALF_BLOCKS)).toEqual(QR_MODULES);
});

it("accepts the inverted polarity of the same art", () => {
  const inverted = QR_HALF_BLOCKS.replace(
    /[█ ▀▄]/g,
    (char) => ({ "█": " ", " ": "█", "▀": "▄", "▄": "▀" })[char] ?? char,
  );
  expect(parseQrModules(inverted)).toEqual(QR_MODULES);
});

it("accepts one full block per module, doubled columns and no-break spaces", () => {
  expect(parseQrModules(fullBlocks("█", " "))).toEqual(QR_MODULES);
  expect(parseQrModules(fullBlocks("██", "  "))).toEqual(QR_MODULES);
  expect(parseQrModules(fullBlocks("█", "\u00a0"))).toEqual(QR_MODULES);
});

it("tolerates trimmed trailing spaces", () => {
  const trimmed = fullBlocks("█", " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  expect(parseQrModules(trimmed)).toEqual(QR_MODULES);
});

it("rejects ordinary code", () => {
  expect(parseQrModules('const branch = "main";\nexport { branch };')).toBeNull();
});

it("rejects block art without a framed symbol", () => {
  expect(parseQrModules("███▀▀▄▄   ██\n█ ▀ ▄ █ ▀ ▄ █")).toBeNull();
  expect(parseQrModules(QR_HALF_BLOCKS.split("\n").slice(0, 10).join("\n"))).toBeNull();
  expect(parseQrModules("")).toBeNull();
});

import { expect, it } from "vitest";

import { RendererCsp } from "#main/csp";

const LOCAL = "http://127.0.0.1:49152";
const REMOTE = "http://127.0.0.1:45010";

it("names every reachable daemon origin and skips the ones not there yet", () => {
  const csp = new RendererCsp(() => [LOCAL, null, ""]);

  expect(csp.headerFor(true)).toContain(`connect-src 'self' ${LOCAL};`);
  expect(csp.headerFor(true)).not.toContain("null");
});

it("lets a switch land in place only on an origin the served document named", () => {
  let urls: Array<string | null> = [LOCAL, null];
  const csp = new RendererCsp(() => urls);

  expect(csp.allows(REMOTE)).toBe(true);
  csp.headerFor(true);
  expect(csp.allows(LOCAL)).toBe(true);
  expect(csp.allows(REMOTE)).toBe(false);

  urls = [LOCAL, REMOTE];
  csp.headerFor(false);
  expect(csp.allows(REMOTE)).toBe(false);
  csp.headerFor(true);
  expect(csp.allows(REMOTE)).toBe(true);
});

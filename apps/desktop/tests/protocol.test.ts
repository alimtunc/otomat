import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { serveAppScheme } from "#main/protocol";
import { scratchDir } from "#support/scratch-dir";

type SchemeHandler = (request: { url: string }) => Promise<Response>;
type Harness = { handler: SchemeHandler | null };

const harness = vi.hoisted((): Harness => ({ handler: null }));

vi.mock("electron", () => ({
  protocol: {
    handle: (_scheme: string, handler: SchemeHandler) => {
      harness.handler = handler;
    },
  },
}));

function serve(): (url: string) => Promise<Response> {
  const webDist = scratchDir("otomat-protocol-");
  writeFileSync(join(webDist, "index.html"), "<!doctype html>index");
  writeFileSync(join(webDist, "app.js"), "export {};");
  serveAppScheme(webDist, () => "default-src 'self'");
  if (harness.handler === null) throw new Error("protocol.handle was not registered");
  const handler = harness.handler;
  return (url) => handler({ url });
}

it("serves index.html for an undecodable pathname instead of failing the load", async () => {
  const request = serve();

  const response = await request("otomat://app/%zz");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toBe("<!doctype html>index");
});

it("still serves a real asset by its decoded path", async () => {
  const request = serve();

  const response = await request("otomat://app/app%2Ejs");

  expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(await response.text()).toBe("export {};");
});

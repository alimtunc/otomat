import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import { findFreeLoopbackPort } from "#shared/ports";

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

describe("findFreeLoopbackPort", () => {
  it("returns a bindable ephemeral loopback port", async () => {
    const port = await findFreeLoopbackPort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65_536);
    expect(await canBind(port)).toBe(true);
  });

  it("hands out more than one distinct port across calls", async () => {
    const ports = await Promise.all([
      findFreeLoopbackPort(),
      findFreeLoopbackPort(),
      findFreeLoopbackPort(),
    ]);
    expect(new Set(ports).size).toBeGreaterThan(1);
  });
});

import {
  terminalIdentitySchema,
  terminalInputSchema,
  terminalOpenSchema,
  terminalResizeSchema,
  terminalToolSchema,
} from "@otomat/domain";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { terminalContext } from "#terminal";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

export function createTerminalRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    return next();
  });
  routes.use("*", bodyLimit({ maxSize: 16384 }));
  routes.get("/", (c) =>
    c.json({ instance: deps.terminals?.instance ?? null, sessions: deps.terminals?.list() ?? [] }),
  );
  const terminals = deps.terminals;
  if (!terminals) {
    routes.all("*", (c) =>
      c.json(
        {
          error: "terminal_unavailable",
          message:
            "This daemon was started without the integrated terminal. Use the external terminal fallback.",
        },
        503,
      ),
    );
    return routes;
  }
  routes.get("/context/:issueId", (c) => {
    const tool = terminalToolSchema.safeParse(c.req.query("tool"));
    if (!tool.success) return c.json({ error: "invalid_tool" }, 400);
    return c.json(terminalContext(deps.db, c.req.param("issueId"), tool.data));
  });
  routes.post("/", validateJson(terminalOpenSchema), async (c) =>
    c.json(await terminals.open(c.req.valid("json"))),
  );
  routes.get("/:id/output", (c) => {
    const instance = c.req.query("instance") ?? "";
    const after = Number(c.req.query("after") ?? 0);
    if (!Number.isSafeInteger(after) || after < 0) return c.json({ error: "invalid_cursor" }, 400);
    return c.json(terminals.output(instance, c.req.param("id"), after));
  });
  routes.post("/:id/input", validateJson(terminalInputSchema), (c) => {
    const input = c.req.valid("json");
    terminals.get(input.instance, c.req.param("id")).write(input.data);
    return c.json({ ok: true });
  });
  routes.post("/:id/resize", validateJson(terminalResizeSchema), (c) => {
    const input = c.req.valid("json");
    terminals.get(input.instance, c.req.param("id")).resize(input.cols, input.rows);
    return c.json({ ok: true });
  });
  routes.post("/:id/close", validateJson(terminalIdentitySchema), async (c) => {
    await terminals.get(c.req.valid("json").instance, c.req.param("id")).close();
    return c.json({ ok: true });
  });
  return routes;
}

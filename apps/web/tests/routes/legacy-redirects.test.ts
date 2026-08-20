// @vitest-environment happy-dom
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "@web/routeTree.gen";
import { expect, it } from "vitest";

async function landsOn(entry: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  await router.load();
  const { pathname, searchStr } = router.state.location;
  return `${pathname}${searchStr}`;
}

it("sends the old agents list into settings, keeping its filter", async () => {
  expect(await landsOn("/agents?filter=skills")).toBe("/settings/agents?filter=skills");
});

it("sends an old agent profile link to the same profile in settings", async () => {
  expect(await landsOn("/agents/profile-1")).toBe("/settings/agents/profile-1");
});

it("sends the old skills catalog into settings", async () => {
  expect(await landsOn("/skills")).toBe("/settings/skills");
});

it("still opens settings on the project it scopes", async () => {
  expect(await landsOn("/settings")).toBe("/settings/project");
});

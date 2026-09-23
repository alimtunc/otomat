// @vitest-environment happy-dom
import { SkeletonGroup } from "@otomat/ui";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(async () => {
  await unmountAll();
});

it("announces a nested placeholder once, from its outermost group", async () => {
  const container = await render(
    <SkeletonGroup>
      <SkeletonGroup>
        <SkeletonGroup />
      </SkeletonGroup>
    </SkeletonGroup>,
  );

  expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  expect(container.querySelectorAll(".otomat-skeleton-group")).toHaveLength(1);
});

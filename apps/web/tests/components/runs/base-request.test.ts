import { launchBaseFields } from "@web/components/runs/launch/base-request";
import { expect, it } from "vitest";

import { readyLaunchTarget } from "#support/launch-target";

it("sends the base branch alone while the repository has a remote to fork from", () => {
  expect(launchBaseFields(readyLaunchTarget())).toEqual({ base_branch: "main" });
});

it("adds the local-base opt-in only once the launch target carries it", () => {
  const target = { ...readyLaunchTarget(), hasRemote: false, localBase: true };

  expect(launchBaseFields(target)).toEqual({ base_branch: "main", local_base: true });
});

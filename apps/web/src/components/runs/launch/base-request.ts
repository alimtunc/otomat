import type { StartRunRequest } from "@otomat/domain";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";

export type LaunchBaseFields = Pick<StartRunRequest, "base_branch" | "local_base">;

export function launchBaseFields(target: ReadyLaunchTarget): LaunchBaseFields {
  return target.localBase
    ? { base_branch: target.baseBranch, local_base: true }
    : { base_branch: target.baseBranch };
}

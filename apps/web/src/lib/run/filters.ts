import type { RunContract } from "@otomat/domain";

export function isRunning(run: Pick<RunContract, "status">): boolean {
  return run.status === "running";
}

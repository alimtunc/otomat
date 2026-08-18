import type { RunContract } from "@otomat/domain";

export function isRunning(run: RunContract): boolean {
  return run.status === "running";
}

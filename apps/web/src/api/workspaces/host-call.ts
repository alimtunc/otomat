import type { ExecutionHostCallResult, ExecutionHostId, OtomatDesktopBridge } from "@otomat/domain";
import {
  activeExecutionHostId,
  desktopBridge,
  requireDesktopBridge,
} from "@web/lib/desktop-bridge";

export class ExecutionHostCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionHostCallError";
  }
}

/** The active host answers on its own client; every other host goes through the bridge, the only side holding its URL. */
export async function onWorkspaceHost<T>(
  hostId: ExecutionHostId,
  active: () => Promise<T>,
  owner: (
    executionHost: OtomatDesktopBridge["executionHost"],
  ) => Promise<ExecutionHostCallResult<T>>,
): Promise<T> {
  if (hostId === activeExecutionHostId()) return active();
  const result = await owner(requireDesktopBridge(desktopBridge()).executionHost);
  if (!result.ok) throw new ExecutionHostCallError(result.message);
  return result.value;
}

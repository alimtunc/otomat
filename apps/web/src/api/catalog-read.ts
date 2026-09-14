import { DaemonRequestError } from "@otomat/client";
import { activeExecutionHostId } from "@web/lib/active-host";

export async function readCatalog<T>(read: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  const host = activeExecutionHostId();
  try {
    return await read();
  } catch (error) {
    if (
      !(error instanceof DaemonRequestError) ||
      error.status !== 404 ||
      activeExecutionHostId() !== host
    ) {
      throw error;
    }
    return legacy();
  }
}

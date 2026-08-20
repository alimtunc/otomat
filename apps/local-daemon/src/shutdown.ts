import type { Supervisor } from "#supervisor";

import type { CloseOptions } from "./server-contract.js";

export interface DaemonShutdownDeps {
  stopMaintenancePasses: () => void;
  supervisor: Supervisor;
  server: { close: (callback: (error?: Error) => void) => void };
  settlePublications: () => Promise<void>;
  closeDatabase: () => void;
}

/** Every step runs whatever the ones before it did: a stranded SQLite handle is worse than a noisy shutdown. */
export function createDaemonClose(
  deps: DaemonShutdownDeps,
): (options?: CloseOptions) => Promise<void> {
  return async (options: CloseOptions = {}) => {
    const failures: unknown[] = [];
    const collect = async (step: () => void | Promise<void>): Promise<void> => {
      try {
        await step();
      } catch (error) {
        failures.push(error);
      }
    };

    await collect(deps.stopMaintenancePasses);
    if (options.terminateInFlightMs !== undefined) {
      const grace = options.terminateInFlightMs;
      await collect(() => deps.supervisor.shutdown(grace));
    }
    await collect(
      () =>
        new Promise<void>((resolve, reject) => {
          deps.server.close((error) => (error ? reject(error) : resolve()));
        }),
    );
    await collect(() => deps.supervisor.settle());
    await collect(deps.settlePublications);
    await collect(deps.closeDatabase);

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures, "Daemon shutdown encountered multiple failures.");
    }
  };
}

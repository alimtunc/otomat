import { closeSync, constants, fsyncSync, openSync, renameSync } from "node:fs";
import { dirname } from "node:path";

import { combineFailures } from "./failure-composition.js";

export function syncManagedPath(path: string): void {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const failures: unknown[] = [];
  try {
    fsyncSync(descriptor);
  } catch (error) {
    failures.push(error);
  }
  try {
    closeSync(descriptor);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw combineFailures(failures, "Path synchronization and handle cleanup both failed.");
  }
}

export function publishPathDurably(source: string, destination: string): void {
  syncManagedPath(source);
  renameSync(source, destination);
  try {
    syncManagedPath(dirname(destination));
  } catch (synchronizationFailure) {
    const rollbackFailures: unknown[] = [];
    try {
      renameSync(destination, source);
    } catch (rollbackFailure) {
      rollbackFailures.push(rollbackFailure);
    }
    if (rollbackFailures.length === 0) {
      try {
        syncManagedPath(dirname(destination));
      } catch (rollbackFailure) {
        rollbackFailures.push(rollbackFailure);
      }
    }
    throw combineFailures(
      [synchronizationFailure, ...rollbackFailures],
      "Path publication was not durable and rollback was attempted.",
    );
  }
}

import { closeSync, constants, fsyncSync, linkSync, openSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { collectCleanupFailure } from "./errors.js";

function durablePublicationFailure(
  synchronizationFailure: unknown,
  rollbackFailures: unknown[],
): AggregateError {
  return new AggregateError(
    [synchronizationFailure, ...rollbackFailures],
    "Path publication was not durable and rollback was attempted.",
    { cause: synchronizationFailure },
  );
}

export class PathReplacementSyncError extends Error {
  constructor(cause: unknown) {
    super("The replacement was installed but its directory entry could not be synchronized.", {
      cause,
    });
    this.name = "PathReplacementSyncError";
  }
}

export function syncManagedPath(path: string): void {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const failures: unknown[] = [];
  try {
    fsyncSync(descriptor);
  } catch (error) {
    failures.push(error);
  }
  collectCleanupFailure(failures, () => closeSync(descriptor));
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Path synchronization and handle cleanup both failed.");
  }
}

export function publishPathDurably(source: string, destination: string): void {
  syncManagedPath(source);
  renameSync(source, destination);
  try {
    syncManagedPath(dirname(destination));
  } catch (syncFailure) {
    const rollbackFailures: unknown[] = [];
    collectCleanupFailure(rollbackFailures, () => renameSync(destination, source));
    if (rollbackFailures.length === 0) {
      collectCleanupFailure(rollbackFailures, () => syncManagedPath(dirname(destination)));
    }
    throw durablePublicationFailure(syncFailure, rollbackFailures);
  }
}

export function replacePathDurably(source: string, destination: string): void {
  syncManagedPath(source);
  renameSync(source, destination);
  try {
    syncManagedPath(dirname(destination));
  } catch (error) {
    throw new PathReplacementSyncError(error);
  }
}

export function publishNewPathDurably(source: string, destination: string): void {
  syncManagedPath(source);
  linkSync(source, destination);
  try {
    syncManagedPath(dirname(destination));
  } catch (synchronizationFailure) {
    const rollbackFailures: unknown[] = [];
    collectCleanupFailure(rollbackFailures, () => rmSync(destination));
    if (rollbackFailures.length === 0) {
      collectCleanupFailure(rollbackFailures, () => syncManagedPath(dirname(destination)));
    }
    throw durablePublicationFailure(synchronizationFailure, rollbackFailures);
  }
  rmSync(source);
  syncManagedPath(dirname(destination));
}

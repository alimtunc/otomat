import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";

export function writeSupportBundleAtomically(path: string, contents: string): void {
  const temporaryPath = `${path}.${randomUUID()}.partial`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    fchmodSync(descriptor, 0o600);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporaryPath, path);
  } catch (error) {
    const failures: unknown[] = [error];
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        failures.push(closeError);
      }
    }
    try {
      rmSync(temporaryPath, { force: true });
    } catch (cleanupError) {
      failures.push(cleanupError);
    }
    const failure = new Error("The support bundle could not be written atomically.", {
      cause: error,
    });
    Object.defineProperty(failure, "cleanupFailures", { value: failures.slice(1) });
    throw failure;
  }
}

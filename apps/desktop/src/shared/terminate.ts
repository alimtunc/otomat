import type { ChildProcess } from "node:child_process";

/**
 * Stops a child with a bounded escalation: SIGTERM (letting the daemon's own handler settle
 * runs and reap its workers), then SIGKILL after `graceMs` if it has not exited. Resolves once
 * the child is gone; a final hard timeout guarantees the promise never hangs on a stuck exit.
 */
export function terminateChild(child: ChildProcess, graceMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
      resolve();
      return;
    }
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(hardTimer);
      resolve();
    };
    child.once("exit", finish);

    trySignal(child, "SIGTERM");
    const killTimer = setTimeout(() => trySignal(child, "SIGKILL"), graceMs);
    const hardTimer = setTimeout(finish, graceMs * 2);
    killTimer.unref();
    hardTimer.unref();
  });
}

function trySignal(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    // ESRCH: already gone — the `exit` listener resolves the promise.
  }
}

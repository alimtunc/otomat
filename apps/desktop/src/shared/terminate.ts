import type { ChildProcess } from "node:child_process";

/**
 * Stops a child with a bounded escalation: SIGTERM (letting the daemon's own handler settle
 * runs and reap its workers), then SIGKILL after `graceMs` if it has not exited. Resolves once
 * the child is gone. Rejects when signal delivery fails or the process cannot be observed exiting.
 */
export function terminateChild(child: ChildProcess, graceMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
      resolve();
      return;
    }
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (failure?: unknown): void => {
      if (settled) return;
      settled = true;
      if (killTimer !== null) clearTimeout(killTimer);
      if (hardTimer !== null) clearTimeout(hardTimer);
      child.off("exit", onExit);
      if (failure === undefined) resolve();
      else reject(failure);
    };
    const onExit = (): void => finish();
    child.once("exit", onExit);

    const termStatus = trySignal(child, "SIGTERM");
    if (settled) return;
    if (termStatus instanceof Error) {
      finish(termStatus);
      return;
    }
    if (termStatus === "gone") {
      finish();
      return;
    }
    killTimer = setTimeout(() => {
      const killStatus = trySignal(child, "SIGKILL");
      if (killStatus instanceof Error) finish(killStatus);
      else if (killStatus === "gone") finish();
    }, graceMs);
    hardTimer = setTimeout(
      () => finish(new Error(`Child process ${String(child.pid)} did not exit after SIGKILL.`)),
      graceMs * 2,
    );
    killTimer.unref();
    hardTimer.unref();
  });
}

function trySignal(child: ChildProcess, signal: NodeJS.Signals): "sent" | "gone" | Error {
  try {
    return child.kill(signal)
      ? "sent"
      : new Error(`Could not deliver ${signal} to child process ${String(child.pid)}.`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH") {
      return "gone";
    }
    return error instanceof Error
      ? error
      : new Error(`Could not deliver ${signal}.`, { cause: error });
  }
}

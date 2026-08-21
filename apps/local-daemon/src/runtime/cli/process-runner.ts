import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { providerProcessEnv } from "./environment.js";

/** Grace between the abort SIGTERM and the forced SIGKILL on the provider child. */
const KILL_GRACE_MS = 5000;

export interface CliProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  /** Piped to the child's stdin first. */
  stdin: string;
  /**
   * Keeps stdin open after `stdin` and writes whatever else the turn accepts;
   * stdin closes once it resolves. `write` resolves when the chunk reached the
   * pipe, and `signal` aborts when the child is gone. Absent closes stdin at once.
   */
  streamStdin?: (write: (chunk: string) => Promise<void>, signal: AbortSignal) => Promise<void>;
  signal: AbortSignal;
  onStdoutLine: (line: string) => void;
  onStderrLine: (line: string) => void;
}

export interface CliProcessExit {
  code: number | null;
  signal: string | null;
  /** True when the exit was caused by the caller's AbortSignal, not the provider. */
  aborted: boolean;
}

/** Streams the child's stdout/stderr line-by-line and resolves only once the process is gone and both pipes are drained; on abort, SIGTERM escalates to SIGKILL on the child's whole process group — no orphaned grandchildren. Rejects only on spawn failure. */
export function runCliProcess(options: CliProcessOptions): Promise<CliProcessExit> {
  return new Promise((resolve, reject) => {
    // detached makes the child a process-group leader, so kill signals reach grandchildren a provider CLI spawns.
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: providerProcessEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });

    const signalChildGroup = (signal: NodeJS.Signals): void => {
      if (child.pid === undefined) {
        child.kill(signal);
        return;
      }
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    };

    // Ends the input pump on every path the child stops being writable, so a live turn never waits on a process that is gone.
    const inputDone = new AbortController();
    let aborted = false;
    let killTimer: NodeJS.Timeout | null = null;
    const onAbort = (): void => {
      aborted = true;
      inputDone.abort();
      signalChildGroup("SIGTERM");
      killTimer = setTimeout(() => signalChildGroup("SIGKILL"), KILL_GRACE_MS);
      killTimer.unref();
    };
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener("abort", onAbort, { once: true });

    const cleanup = (): void => {
      options.signal.removeEventListener("abort", onAbort);
      if (killTimer !== null) clearTimeout(killTimer);
    };

    createInterface({ input: child.stdout }).on("line", options.onStdoutLine);
    createInterface({ input: child.stderr }).on("line", options.onStderrLine);

    child.on("error", (error) => {
      cleanup();
      inputDone.abort();
      reject(error);
    });
    // "close" (not "exit") so both pipes are fully drained before the caller settles.
    child.on("close", (code, signal) => {
      cleanup();
      inputDone.abort();
      resolve({ code, signal, aborted });
    });

    child.stdin.on("error", () => {
      // The provider may exit before reading stdin; losing the pipe is not a runner failure.
    });

    const { streamStdin } = options;
    if (streamStdin === undefined) {
      child.stdin.end(options.stdin);
      return;
    }
    const write = (chunk: string): Promise<void> =>
      new Promise((resolveWrite, rejectWrite) => {
        child.stdin.write(chunk, (error) => (error ? rejectWrite(error) : resolveWrite()));
      });
    // The pump owns stdin until it resolves, so nothing else can close the pipe under a pending write.
    void write(options.stdin)
      .then(
        () => streamStdin(write, inputDone.signal),
        // The provider may exit before reading the prompt; like the non-streaming path, exit classification decides, not the lost pipe.
        () => undefined,
      )
      .then(
        () => child.stdin.end(),
        // A settled exit already resolved this promise, so rejecting late is the no-op the spec makes it.
        (error: unknown) => {
          child.stdin.end();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
  });
}

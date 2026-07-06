import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

/** Grace between the abort SIGTERM and the forced SIGKILL on the provider child. */
const KILL_GRACE_MS = 5000;

export interface CliProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  /** Piped to the child's stdin, then stdin is closed. */
  stdin: string;
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

/** Ambient nested-session markers scrubbed so a provider spawned by the daemon never believes it runs inside another agent session (same isolation stance as the daemon git wrapper). */
function scrubbedEnv(): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) continue;
    clean[key] = value;
  }
  return clean;
}

/** Streams the child's stdout/stderr line-by-line and resolves only once the process is gone and both pipes are drained; on abort, SIGTERM escalates to SIGKILL on the child's whole process group — no orphaned grandchildren. Rejects only on spawn failure. */
export function runCliProcess(options: CliProcessOptions): Promise<CliProcessExit> {
  return new Promise((resolve, reject) => {
    // detached makes the child a process-group leader, so kill signals reach grandchildren a provider CLI spawns.
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: scrubbedEnv(),
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

    let aborted = false;
    let killTimer: NodeJS.Timeout | null = null;
    const onAbort = (): void => {
      aborted = true;
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
      reject(error);
    });
    // "close" (not "exit") so both pipes are fully drained before the caller settles.
    child.on("close", (code, signal) => {
      cleanup();
      resolve({ code, signal, aborted });
    });

    child.stdin.on("error", () => {
      // The provider may exit before reading stdin; losing the pipe is not a runner failure.
    });
    child.stdin.end(options.stdin);
  });
}

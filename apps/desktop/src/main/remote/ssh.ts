import { spawn } from "node:child_process";

// BatchMode makes ssh fail instead of ever prompting: auth and host keys must already work from the user's own config/agent.
export const SSH_BATCH_ARGS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"] as const;

export interface SshScriptResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface RunSshScriptOptions {
  alias: string;
  script: string;
  timeoutMs: number;
}

/** The script travels over stdin (no remote-quoting layer); `bash -ls` resolves the user's login PATH like an interactive session. */
export function runSshScript(options: RunSshScriptOptions): Promise<SshScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [...SSH_BATCH_ARGS, options.alias, "bash", "-ls"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`ssh to ${options.alias} timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);
    timer.unref();
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin?.end(options.script);
  });
}

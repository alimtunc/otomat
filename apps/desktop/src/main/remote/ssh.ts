import { spawn } from "node:child_process";

/**
 * `BatchMode=yes` makes ssh fail instead of ever prompting (passwords, host-key
 * questions): authentication must come from the user's own config/agent, and an
 * unknown host key surfaces as an honest error telling the user to connect once
 * manually.
 */
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
  spawnImpl?: typeof spawn;
}

/**
 * Runs a script on the remote host as `ssh <alias> bash -ls`, delivering the
 * script over stdin so no remote-quoting layer is involved. The login shell
 * (`-l`) resolves the user's PATH (nvm, ~/.local/bin) like an interactive
 * session would.
 */
export function runSshScript(options: RunSshScriptOptions): Promise<SshScriptResult> {
  const doSpawn = options.spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const child = doSpawn("ssh", [...SSH_BATCH_ARGS, options.alias, "bash", "-ls"], {
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

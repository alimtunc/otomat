import { spawn } from "node:child_process";

import { scrubGitEnv } from "#git/git-cli";

import type { CommandRequest, CommandResult } from "./types.js";

const MAX_CAPTURED_OUTPUT = 1024 * 1024;

function appendBounded(current: string, chunk: Buffer): string {
  if (current.length >= MAX_CAPTURED_OUTPUT) return current;
  return (current + chunk.toString("utf8")).slice(0, MAX_CAPTURED_OUTPUT);
}

/** Runs one argv-safe child process without a shell and captures bounded UTF-8 output. */
export function runCommand(request: CommandRequest): Promise<CommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: scrubGitEnv(process.env),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr, exitCode: null, errorCode: error.code ?? "spawn_failed" });
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr, exitCode });
    });

    child.stdin.end(request.stdin ?? "");
  });
}

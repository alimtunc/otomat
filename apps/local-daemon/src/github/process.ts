import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

import { scrubGitEnv } from "#git/git-cli";

import type { CommandRequest, CommandResult } from "./types.js";

const MAX_CAPTURED_OUTPUT = 1024 * 1024;

function appendBounded(current: string, chunk: string): string {
  if (current.length >= MAX_CAPTURED_OUTPUT) return current;
  return (current + chunk).slice(0, MAX_CAPTURED_OUTPUT);
}

function createOutputCapture() {
  let output = "";
  const decoder = new StringDecoder("utf8");
  return {
    write(chunk: Buffer) {
      output = appendBounded(output, decoder.write(chunk));
    },
    finish() {
      output = appendBounded(output, decoder.end());
      return output;
    },
  };
}

export function runCommand(request: CommandRequest): Promise<CommandResult> {
  return new Promise((resolve) => {
    let settled = false;
    let stdinErrorCode: string | undefined;
    const stdout = createOutputCapture();
    const stderr = createOutputCapture();
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: scrubGitEnv(process.env),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const finish = (exitCode: number | null, errorCode?: string) => {
      if (settled) return;
      settled = true;
      resolve({
        stdout: stdout.finish(),
        stderr: stderr.finish(),
        exitCode,
        ...(errorCode ? { errorCode } : {}),
      });
    };

    child.stdout.on("data", (chunk: Buffer) => stdout.write(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.write(chunk));
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      stdinErrorCode = error.code ?? "stdin_write_failed";
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(null, error.code ?? "spawn_failed");
    });
    child.on("close", (exitCode) => {
      finish(exitCode, stdinErrorCode);
    });

    child.stdin.end(request.stdin ?? "");
  });
}

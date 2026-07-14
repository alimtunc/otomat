import { expect, it } from "vitest";

import { runCommand } from "#github";

it("runs a command asynchronously and writes stdin without a shell", async () => {
  const result = await runCommand({
    command: process.execPath,
    args: [
      "-e",
      "process.stdin.setEncoding('utf8');let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>process.stdout.write(s.toUpperCase()))",
    ],
    cwd: process.cwd(),
    stdin: "safe body",
  });

  expect(result).toEqual({ stdout: "SAFE BODY", stderr: "", exitCode: 0 });
});

it("returns a safe spawn error code when the executable is missing", async () => {
  const result = await runCommand({
    command: "otomat-command-that-does-not-exist",
    args: [],
    cwd: process.cwd(),
  });

  expect(result).toMatchObject({ exitCode: null, errorCode: "ENOENT" });
});

it("waits for child exit and preserves output after stdin closes early", async () => {
  const uncaught: Error[] = [];
  const captureUncaught = (error: Error) => uncaught.push(error);
  process.once("uncaughtException", captureUncaught);

  try {
    const result = await runCommand({
      command: process.execPath,
      args: [
        "-e",
        "process.stdin.destroy();setTimeout(()=>process.stdout.write('finished'),20);setTimeout(()=>process.exit(0),40)",
      ],
      cwd: process.cwd(),
      stdin: "x".repeat(32 * 1024 * 1024),
    });

    expect(uncaught).toEqual([]);
    expect(result).toEqual({ stdout: "finished", stderr: "", exitCode: 0, errorCode: "EPIPE" });
  } finally {
    process.removeListener("uncaughtException", captureUncaught);
  }
});

it("decodes a multibyte stdout character split across chunks", async () => {
  const result = await runCommand({
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write(Buffer.from([0xf0,0x9f]));setTimeout(()=>process.stdout.end(Buffer.from([0x98,0x80])),20)",
    ],
    cwd: process.cwd(),
  });

  expect(result).toEqual({ stdout: "😀", stderr: "", exitCode: 0 });
});

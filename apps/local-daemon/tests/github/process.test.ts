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

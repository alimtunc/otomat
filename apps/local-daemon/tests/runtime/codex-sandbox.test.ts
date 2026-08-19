import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearCodexSandboxProbeCache, probeCodexSandbox } from "#runtime/providers/codex/sandbox";

let directory: string;
let binary: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "otomat-codex-sandbox-"));
  binary = join(directory, "codex");
  writeFileSync(
    binary,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then',
      '  printf "%s\\n" "codex-cli 0.148.0"',
      "  exit 0",
      "fi",
      'printf "%s\\n" "$@" > "$OTOMAT_CODEX_PROBE_ARGS_FILE"',
      'if [ -n "$OTOMAT_CODEX_PROBE_STDERR" ]; then',
      '  printf "%s\\n" "$OTOMAT_CODEX_PROBE_STDERR" >&2',
      "fi",
      'exit "${OTOMAT_CODEX_PROBE_EXIT:-0}"',
    ].join("\n"),
  );
  chmodSync(binary, 0o755);
  clearCodexSandboxProbeCache();
});

afterEach(() => {
  clearCodexSandboxProbeCache();
  rmSync(directory, { recursive: true, force: true });
});

describe("Codex sandbox capability probe", () => {
  it("runs a credential-free no-op through the installed sandbox", () => {
    const argsFile = join(directory, "args.txt");
    const result = probeCodexSandbox(binary, directory, {
      ...process.env,
      OTOMAT_CODEX_PROBE_ARGS_FILE: argsFile,
    });

    expect(result.status).toBe("available");
    expect(readFileSync(argsFile, "utf8").trim().split("\n")).toEqual(["sandbox", "true"]);
    expect(result.diagnostics).toMatchObject({
      codexVersion: "codex-cli 0.148.0",
      cwd: directory,
      exitCode: 0,
      stderr: "",
    });
  });

  it("classifies the RTM_NEWADDR signature as a denied loopback namespace capability", () => {
    const result = probeCodexSandbox(binary, directory, {
      ...process.env,
      OTOMAT_CODEX_PROBE_ARGS_FILE: join(directory, "args.txt"),
      OTOMAT_CODEX_PROBE_EXIT: "1",
      OTOMAT_CODEX_PROBE_STDERR: "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      cause: "loopback_namespace_denied",
      diagnostics: {
        exitCode: 1,
        stderr: "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted",
      },
    });
    if (result.status === "unavailable") {
      expect(result.remediation).toMatch(/AppArmor|user namespace/i);
    }
  });
});

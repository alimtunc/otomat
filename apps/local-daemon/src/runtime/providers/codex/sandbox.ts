import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { arch, hostname, platform, release } from "node:os";
import { sep } from "node:path";

import { redactLogText } from "@otomat/domain";

import { resolveBinaryPath } from "#runtime/availability";
import { providerProcessEnv } from "#runtime/cli/environment";
import { RuntimeUnavailableError } from "#runtime/errors";

const PROBE_ARGS = ["sandbox", "true"] as const;
const PROBE_TIMEOUT_MS = 10_000;
const PROBE_MAX_BUFFER = 1024 * 1024;
const DIAGNOSTIC_MAX_LENGTH = 2_000;
const successful = new Map<string, CodexSandboxProbeResult>();

export interface CodexSandboxDiagnostics {
  host: string;
  executionEnvironment: "local" | "ssh";
  platform: string;
  codexVersion: string | null;
  args: readonly string[];
  cwd: string;
  exitCode: number | null;
  stderr: string;
  capabilities: {
    unprivilegedUserNamespaceClone: string;
    maxUserNamespaces: string;
    appArmorRestrictsUnprivilegedUserNamespaces: string;
  };
}

export type CodexSandboxProbeResult =
  | { status: "available"; diagnostics: CodexSandboxDiagnostics }
  | {
      status: "unavailable";
      cause: "loopback_namespace_denied" | "sandbox_probe_failed";
      remediation: string;
      diagnostics: CodexSandboxDiagnostics;
    };

export class CodexSandboxUnavailableError extends RuntimeUnavailableError {
  constructor(
    requestedSandbox: string,
    resolvedSandbox: string,
    agentArgs: readonly string[],
    probe: Extract<CodexSandboxProbeResult, { status: "unavailable" }>,
  ) {
    super(
      "codex",
      "sandbox_unavailable",
      unavailableMessage(requestedSandbox, resolvedSandbox, agentArgs, probe),
    );
    this.name = "CodexSandboxUnavailableError";
  }
}

export function clearCodexSandboxProbeCache(): void {
  successful.clear();
}

function bounded(value: string): string {
  return redactLogText(value).trim().slice(0, DIAGNOSTIC_MAX_LENGTH);
}

function kernelSetting(path: string): string {
  try {
    return readFileSync(path, "utf8").trim() || "empty";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `unavailable: ${bounded(message)}`;
  }
}

function binaryKey(binary: string, cwd: string, env: NodeJS.ProcessEnv): string | null {
  const path = binary.includes(sep) ? binary : resolveBinaryPath(binary, env);
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return `${path}:${String(stat.size)}:${String(stat.mtimeMs)}:${cwd}`;
  } catch {
    return null;
  }
}

function codexVersion(binary: string, env: NodeJS.ProcessEnv): string | null {
  const result = spawnSync(binary, ["--version"], {
    encoding: "utf8",
    env: providerProcessEnv(env),
    timeout: PROBE_TIMEOUT_MS,
    maxBuffer: PROBE_MAX_BUFFER,
  });
  if (result.status !== 0 || result.error) return null;
  return bounded(result.stdout ?? "") || null;
}

function remediation(
  cause: Extract<CodexSandboxProbeResult, { status: "unavailable" }>["cause"],
  appArmor: string,
): string {
  if (cause === "loopback_namespace_denied") {
    return `Allow the Codex sandbox to create user/network namespaces and configure loopback under this host's AppArmor policy. kernel.apparmor_restrict_unprivileged_userns=${appArmor}. Apply a scoped host policy or an approved host-level user-namespace change, then retry. Otomat did not fall back to danger-full-access.`;
  }
  return "Run the reported credential-free probe on this host, correct the Codex CLI or namespace capability it reports, then retry. Otomat did not disable the sandbox.";
}

function unavailableMessage(
  requested: string,
  resolved: string,
  agentArgs: readonly string[],
  result: Extract<CodexSandboxProbeResult, { status: "unavailable" }>,
): string {
  const { diagnostics } = result;
  const capabilities = JSON.stringify(diagnostics.capabilities);
  return [
    `Codex sandbox unavailable on host "${diagnostics.host}" (${diagnostics.executionEnvironment}, ${diagnostics.platform}).`,
    `Cause: ${result.cause}.`,
    `Codex CLI: ${diagnostics.codexVersion ?? "version unavailable"}.`,
    `Sandbox requested=${requested}; resolved=${resolved}.`,
    `Agent argv=${JSON.stringify(agentArgs)}.`,
    `Probe argv=${JSON.stringify(diagnostics.args)}; cwd=${diagnostics.cwd}; exit=${String(diagnostics.exitCode)}; stderr=${JSON.stringify(diagnostics.stderr)}.`,
    `Capabilities=${capabilities}.`,
    `Remediation: ${result.remediation}`,
  ].join(" ");
}

export function probeCodexSandbox(
  binary: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): CodexSandboxProbeResult {
  const key = binaryKey(binary, cwd, env);
  const hit = key === null ? undefined : successful.get(key);
  if (hit) return hit;

  const cleanEnv = providerProcessEnv(env);
  const result = spawnSync(binary, PROBE_ARGS, {
    cwd,
    env: cleanEnv,
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
    maxBuffer: PROBE_MAX_BUFFER,
  });
  const appArmor = kernelSetting("/proc/sys/kernel/apparmor_restrict_unprivileged_userns");
  const stderr = bounded(result.error?.message ?? result.stderr ?? "");
  const diagnostics: CodexSandboxDiagnostics = {
    host: hostname(),
    executionEnvironment: cleanEnv.SSH_CONNECTION || cleanEnv.SSH_CLIENT ? "ssh" : "local",
    platform: `${platform()} ${release()} ${arch()}`,
    codexVersion: codexVersion(binary, env),
    args: PROBE_ARGS,
    cwd,
    exitCode: result.status,
    stderr,
    capabilities: {
      unprivilegedUserNamespaceClone: kernelSetting("/proc/sys/kernel/unprivileged_userns_clone"),
      maxUserNamespaces: kernelSetting("/proc/sys/user/max_user_namespaces"),
      appArmorRestrictsUnprivilegedUserNamespaces: appArmor,
    },
  };
  if (!result.error && result.signal === null && result.status === 0) {
    const available = { status: "available", diagnostics } as const;
    if (key !== null) successful.set(key, available);
    return available;
  }
  const cause =
    stderr.includes("Failed RTM_NEWADDR") &&
    stderr.toLowerCase().includes("operation not permitted")
      ? "loopback_namespace_denied"
      : "sandbox_probe_failed";
  return {
    status: "unavailable",
    cause,
    remediation: remediation(cause, appArmor),
    diagnostics,
  };
}

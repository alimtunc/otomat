import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import {
  DEFAULT_EXECUTION_HOSTS_CONFIG,
  executionHostsConfigPath,
  readExecutionHostsConfig,
  writeExecutionHostsConfig,
} from "#main/remote/hosts-config";

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-hosts-config-"));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("returns the local-only default when no config file exists", () => {
  expect(readExecutionHostsConfig(scratch())).toEqual(DEFAULT_EXECUTION_HOSTS_CONFIG);
});

it("round-trips a written config", () => {
  const dir = scratch();
  const config = {
    version: 1,
    remote: { ssh_alias: "otomat-vps" },
    active: "remote",
  } as const;
  writeExecutionHostsConfig(dir, config);
  expect(readExecutionHostsConfig(dir)).toEqual(config);
});

it("stores only the alias name, never credentials", () => {
  const dir = scratch();
  writeExecutionHostsConfig(dir, { version: 1, remote: { ssh_alias: "vps" }, active: "local" });
  const raw = readFileSync(executionHostsConfigPath(dir), "utf8");
  expect(raw).not.toMatch(/key|password|token|secret/i);
  expect(JSON.parse(raw)).toEqual({ version: 1, remote: { ssh_alias: "vps" }, active: "local" });
});

it("throws on unparseable content instead of silently defaulting", () => {
  const dir = scratch();
  writeFileSync(executionHostsConfigPath(dir), "not json");
  expect(() => readExecutionHostsConfig(dir)).toThrow();
});

it.each([
  { version: 2, remote: null, active: "local" },
  { version: 1, remote: null, active: "remote" },
  { version: 1, remote: { ssh_alias: "" }, active: "local" },
  { version: 1, remote: { ssh_alias: 7 }, active: "local" },
  { version: 1, remote: null, active: "elsewhere" },
])("rejects the invalid shape %j", (invalid) => {
  const dir = scratch();
  writeFileSync(executionHostsConfigPath(dir), JSON.stringify(invalid));
  expect(() => readExecutionHostsConfig(dir)).toThrow(/invalid execution-hosts config/i);
});

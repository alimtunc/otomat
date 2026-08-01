import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { listSshConfigAliases } from "#main/remote/ssh-config-aliases";

const scratchDirs: string[] = [];

function configWith(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-ssh-config-"));
  scratchDirs.push(dir);
  const path = join(dir, "config");
  writeFileSync(path, content);
  return path;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("lists concrete Host aliases, skipping patterns and keyword lookalikes", () => {
  const path = configWith(
    [
      "Host otomat-vps",
      "  HostName 203.0.113.7",
      "  User ubuntu",
      "Host *.internal !prod-*",
      "Host build-box otomat-vps",
      "  Port 2222",
      "host lowercase-entry",
      "# Host commented-out",
    ].join("\n"),
  );
  expect(listSshConfigAliases(path)).toEqual(["build-box", "lowercase-entry", "otomat-vps"]);
});

it("returns an empty list when the ssh config does not exist", () => {
  expect(listSshConfigAliases("/nonexistent/.ssh/config")).toEqual([]);
});

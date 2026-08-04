import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import { listSshConfigAliases } from "#main/remote/ssh/config-aliases";
import { scratchDir } from "#support/scratch-dir";

function configWith(content: string): string {
  const path = join(scratchDir("otomat-ssh-config-"), "config");
  writeFileSync(path, content);
  return path;
}

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

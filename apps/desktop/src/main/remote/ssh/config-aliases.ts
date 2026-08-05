import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { hasErrorCode } from "#shared/fs-errors";

/** A single word ssh will not read as an option; every other rejection belongs to ssh itself. */
export function normalizeSshAlias(value: unknown): { alias: string } | { message: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { message: "Enter an SSH alias from ~/.ssh/config." };
  }
  const alias = value.trim();
  if (/\s/.test(alias) || alias.startsWith("-")) {
    return { message: "The SSH alias must be a single word." };
  }
  return { alias };
}

// Pattern entries (*, ?, !) are skipped and Include files are not followed — aliases there still work, they just are not suggested.
export function listSshConfigAliases(configPath = join(homedir(), ".ssh", "config")): string[] {
  let text: string;
  try {
    text = readFileSync(configPath, "utf8");
  } catch (error) {
    if (hasErrorCode(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const aliases = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*host\s+(.+)$/i.exec(line);
    if (match === null || match[1] === undefined) continue;
    for (const token of match[1].trim().split(/\s+/)) {
      if (token === "" || /[*?!]/.test(token)) continue;
      aliases.add(token);
    }
  }
  return [...aliases].toSorted((left, right) => left.localeCompare(right));
}

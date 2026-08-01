import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function hasErrorCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

export function defaultSshConfigPath(): string {
  return join(homedir(), ".ssh", "config");
}

/**
 * Concrete `Host` aliases from the user's ssh config, offered as suggestions when
 * configuring the remote host. Pattern entries (`*`, `?`, `!`) are skipped and
 * `Include` directives are not followed — an alias defined there still works, it
 * just is not suggested.
 */
export function listSshConfigAliases(configPath = defaultSshConfigPath()): string[] {
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

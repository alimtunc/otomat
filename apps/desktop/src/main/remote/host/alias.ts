import type { listSshConfigAliases } from "../ssh/config-aliases.js";

export type SshAliasValidation = { alias: string } | { message: string };

/**
 * A configured alias goes straight into `ssh`'s argv, so it must be one concrete word: no
 * whitespace to split on, and never a leading `-` that ssh would read as a flag.
 */
export function validateSshAlias(value: unknown): SshAliasValidation {
  if (typeof value !== "string" || value.trim() === "") {
    return { message: "Enter an SSH alias from ~/.ssh/config." };
  }
  const alias = value.trim();
  if (/\s/.test(alias) || alias.startsWith("-")) {
    return { message: "The SSH alias must be a single word." };
  }
  return { alias };
}

/** Suggestions are a convenience: an unreadable `~/.ssh/config` costs the list, never the host. */
export function safeSshAliases(
  read: typeof listSshConfigAliases,
  log: (message: string) => void,
): string[] {
  try {
    return read();
  } catch (error) {
    log(`Could not read ~/.ssh/config aliases: ${String(error)}`);
    return [];
  }
}

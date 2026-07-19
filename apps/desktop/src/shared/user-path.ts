import { execFileSync } from "node:child_process";
import { delimiter } from "node:path";

import { USER_PATH_TIMEOUT_MS } from "#shared/constants";

export interface UserPathOptions {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** Prints the login shell's `$PATH`; returns its stdout, or null on failure/timeout. Injected for tests. */
  readLoginPath?: (shell: string) => string | null;
}

/** Homebrew + common user bins a Finder-launched GUI's minimal PATH misses. */
const DARWIN_FALLBACK_DIRS = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/local/sbin",
];

/** Reads ONLY `$PATH` from an interactive login shell — never any other variable, so no tokens are ever read. */
function defaultReadLoginPath(shell: string): string | null {
  try {
    const out = execFileSync(shell, ["-ilc", 'printf %s "$PATH"'], {
      timeout: USER_PATH_TIMEOUT_MS,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() === "" ? null : out;
  } catch {
    // Shell missing, non-interactive, or timed out: fall back to the process PATH + known dirs.
    return null;
  }
}

function dedupePath(parts: string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const dir = part.trim();
    if (dir === "" || seen.has(dir)) continue;
    seen.add(dir);
    kept.push(dir);
  }
  return kept.join(delimiter);
}

/**
 * Builds the PATH the daemon child should run with. A macOS app opened from Finder inherits a
 * minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), so it would not find Homebrew/user CLIs like
 * `git`, `gh`, `claude`, `codex`. This merges the current PATH with the login shell's PATH and
 * common bin dirs, deduped and order-preserving. Only PATH is read from the shell — no tokens.
 */
export function resolveUserPath(options: UserPathOptions): string {
  const { platform, env } = options;
  const currentPath = env.PATH ?? "";
  if (platform === "win32") return currentPath;

  const readLoginPath = options.readLoginPath ?? defaultReadLoginPath;
  const loginPath = readLoginPath(env.SHELL ?? "/bin/zsh");

  const home = env.HOME ?? "";
  const fallbacks = platform === "darwin" ? DARWIN_FALLBACK_DIRS : [];
  const homeLocal = home === "" ? [] : [`${home}/.local/bin`];

  return dedupePath([
    ...currentPath.split(delimiter),
    ...(loginPath === null ? [] : loginPath.split(delimiter)),
    ...fallbacks,
    ...homeLocal,
  ]);
}

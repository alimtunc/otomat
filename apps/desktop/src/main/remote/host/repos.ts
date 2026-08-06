import type { RemoteRepositoryEntry, RemoteRepositoryListResult } from "@otomat/domain";

import { scriptFailure, trimDetail } from "../bootstrap/status.js";
import { runSshScript, type SshScriptResult } from "../ssh/script.js";

const HOME_PREFIX = "OTOMAT_REPO_HOME:";
const REPO_PREFIX = "OTOMAT_REPO:";
const REPOS_END = "OTOMAT_REPOS_END:-";

const SCRIPT_TIMEOUT_MS = 30_000;

// Directories that hold no project of the user's own but cost the most to walk.
const PRUNED = [
  "node_modules",
  ".cache",
  ".npm",
  ".pnpm-store",
  ".nvm",
  ".cargo",
  ".rustup",
  ".local",
  ".venv",
  "venv",
  "vendor",
  "target",
  "dist",
  "snap",
  "Library",
];

export function listRepositoriesScript(): string {
  const prune = PRUNED.map((name) => `-name ${name}`).join(" -o ");
  return [
    "set -u",
    `echo "${HOME_PREFIX}$HOME"`,
    // `.git` is pruned as it is printed, so a repository's own object store is never walked; the
    // discarded stderr is the unreadable-directory noise of a home walk, not a lost failure.
    `find "$HOME" -maxdepth 4 \\( -type d -name .git -print -prune \\) -o \\( -type d \\( ${prune} \\) -prune \\) 2>/dev/null |`,
    "  while IFS= read -r gitdir; do",
    '    repo="$(dirname "$gitdir")"',
    `    printf '${REPO_PREFIX}%s\\n' "\${repo#"$HOME/"}"`,
    "  done",
    `echo "${REPOS_END}"`,
    "",
  ].join("\n");
}

/** Null when the END or home token is missing — a truncated listing must never read as "no repositories". */
export function parseRepositoryList(stdout: string): RemoteRepositoryEntry[] | null {
  const lines = stdout.split(/\r?\n/);
  if (!lines.some((line) => line.startsWith(REPOS_END))) return null;
  const homeLine = lines.find((line) => line.startsWith(HOME_PREFIX));
  const home = homeLine?.slice(HOME_PREFIX.length).trim();
  if (home === undefined || !home.startsWith("/")) return null;
  const entries = new Map<string, RemoteRepositoryEntry>();
  for (const line of lines) {
    if (!line.startsWith(REPO_PREFIX)) continue;
    const label = line.slice(REPO_PREFIX.length).trim();
    // A `.git` directly in $HOME reports the home itself — an absolute path, and no project root.
    if (label === "" || label.startsWith("/")) continue;
    entries.set(label, { path: `${home}/${label}`, label });
  }
  return [...entries.values()].toSorted((left, right) => left.label.localeCompare(right.label));
}

export async function listRemoteRepositories(
  alias: string | null,
  runScript: typeof runSshScript = runSshScript,
): Promise<RemoteRepositoryListResult> {
  if (alias === null) return { ok: false, message: "No remote host is configured." };
  let result: SshScriptResult;
  try {
    const script = listRepositoriesScript();
    result = await runScript({ alias, script, timeoutMs: SCRIPT_TIMEOUT_MS });
  } catch (error) {
    return { ok: false, message: trimDetail(String(error)) };
  }
  if (result.code !== 0) return { ok: false, message: scriptFailure(result) };
  const repositories = parseRepositoryList(result.stdout);
  if (repositories === null) {
    return { ok: false, message: "The repository listing never completed." };
  }
  return { ok: true, repositories };
}

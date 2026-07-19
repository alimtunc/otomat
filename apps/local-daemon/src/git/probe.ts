import { realpathSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

import type { RepositoryRegistrationError } from "@otomat/domain";

import { runGit } from "./git-cli.js";

/** Registration-time refusals only; duplicate detection happens against the store, not the filesystem. */
export type RepositoryProbeError = Exclude<
  RepositoryRegistrationError,
  "repository_already_registered"
>;

export type RepositoryProbe =
  | { ok: true; rootPath: string; defaultBranch: string }
  | { ok: false; error: RepositoryProbeError };

/** Resolves a path canonically, or returns null when the filesystem cannot resolve it. */
export function tryRealpath(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/**
 * Validates a user-supplied path as a registrable local repository: absolute,
 * existing directory, repository root, and attached HEAD resolving to a commit.
 * Refusable paths are returned as typed errors instead of being thrown.
 */
export function probeLocalRepository(inputPath: string): RepositoryProbe {
  if (!isAbsolute(inputPath)) return { ok: false, error: "path_not_absolute" };

  const canonical = tryRealpath(inputPath);
  if (canonical === null) return { ok: false, error: "path_not_found" };
  if (!statSync(canonical).isDirectory()) return { ok: false, error: "path_not_directory" };

  const inside = runGit(["rev-parse", "--is-inside-work-tree"], {
    cwd: canonical,
    allowFailure: true,
  });
  if (inside.exitCode !== 0 || inside.stdout.trim() !== "true") {
    return { ok: false, error: "path_not_git_repository" };
  }

  const toplevel = runGit(["rev-parse", "--show-toplevel"], { cwd: canonical, allowFailure: true });
  const toplevelPath = toplevel.exitCode === 0 ? tryRealpath(toplevel.stdout.trim()) : null;
  if (toplevelPath === null || toplevelPath !== canonical) {
    return { ok: false, error: "path_not_repository_root" };
  }

  const branchRef = runGit(["symbolic-ref", "--short", "-q", "HEAD"], {
    cwd: canonical,
    allowFailure: true,
  });
  const branch = branchRef.stdout.trim();
  if (branchRef.exitCode !== 0 || branch === "") return { ok: false, error: "head_detached" };

  const verified = runGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: canonical,
    allowFailure: true,
  });
  if (verified.exitCode !== 0) return { ok: false, error: "default_branch_undetectable" };

  return { ok: true, rootPath: canonical, defaultBranch: branch };
}

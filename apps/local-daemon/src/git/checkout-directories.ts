import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { WorktreeFileEntry } from "@otomat/domain";

import { GitCommandError } from "./errors.js";
import { runGit } from "./git-cli.js";
import { isInsideRoot } from "./probe.js";

export function checkoutDirectories(cwd: string): WorktreeFileEntry[] {
  const candidates = runGit(["ls-files", "--others", "--directory", "--exclude-standard", "-z"], {
    cwd,
  }).stdout;
  const entries: WorktreeFileEntry[] = [];
  const walk = (path: string): void => {
    const target = join(cwd, path);
    if (!isInsideRoot(cwd, target)) return;
    const stat = lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink() || existsSync(join(target, ".git"))) return;
    entries.push({ path, kind: "directory", size: 0 });
    const children = readdirSync(target, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${path}/${entry.name}`);
    if (children.length === 0) return;
    const args = ["check-ignore", "-z", "--stdin"];
    const ignored = runGit(args, {
      cwd,
      input: children.map((child) => `${child}/\0`).join(""),
      allowFailure: true,
    });
    if (ignored.exitCode !== 0 && ignored.exitCode !== 1) {
      throw new GitCommandError(args, cwd, ignored.exitCode, ignored.stderr);
    }
    const excluded = new Set(ignored.stdout.split("\0"));
    for (const child of children) if (!excluded.has(`${child}/`)) walk(child);
  };
  for (const path of candidates.split("\0")) {
    if (path.endsWith("/")) walk(path.slice(0, -1));
  }
  return entries;
}

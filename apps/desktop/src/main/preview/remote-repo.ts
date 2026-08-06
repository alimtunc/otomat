import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { lastToken } from "../remote/ssh/tokens.js";

const TOKEN_PREFIX = "OTOMAT_SANDBOX:";
const HEREDOC = "OTOMAT_SANDBOX_EOF";

// Same identity and no signing as the local fixture repository: the commit must succeed on a
// host with no git configuration at all, and must never touch the user's own config.
const GIT_IDENTITY =
  "-c 'user.name=Otomat Sandbox' -c user.email=sandbox@otomat.local -c commit.gpgsign=false";

const HOME_SUFFIX = /^\.otomat\/instances\/([0-9a-f]{7}|unknown)$/;
const TEMPLATE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Dotfiles are fine; traversal, shell metacharacters and empty segments are not. */
function isSafeTemplatePath(path: string): boolean {
  return path
    .split("/")
    .every((segment) => TEMPLATE_SEGMENT.test(segment) && segment !== "." && segment !== "..");
}

export interface SandboxTemplateFile {
  /** Path relative to the repository root, always POSIX-separated. */
  path: string;
  contents: string;
}

/** Reads the shipped template file by file, the way the local fixture is copied out of the asar. */
export function readSandboxTemplate(dir: string, prefix = ""): SandboxTemplateFile[] {
  const files: SandboxTemplateFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...readSandboxTemplate(join(dir, entry.name), path));
    else files.push({ path, contents: readFileSync(join(dir, entry.name), "utf8") });
  }
  return files;
}

/**
 * The fixture lives inside the instance home so deleting the instance takes it along; an
 * already-committed repository is left untouched, so a reconnect costs one round trip.
 */
export function sandboxRepoScript(homeSuffix: string, files: SandboxTemplateFile[]): string {
  if (!HOME_SUFFIX.test(homeSuffix)) {
    throw new Error(`refusing to build a sandbox script for home suffix "${homeSuffix}"`);
  }
  const lines = [
    "set -u",
    `DIR="$HOME/${homeSuffix}/test-repo"`,
    `if [ -d "$DIR/.git" ] && git -C "$DIR" rev-parse --verify HEAD >/dev/null 2>&1; then`,
    `  echo "${TOKEN_PREFIX}READY:$(cd "$DIR" && pwd -P)"`,
    "  exit 0",
    "fi",
    "if ! command -v git >/dev/null 2>&1; then",
    `  echo "${TOKEN_PREFIX}NO_GIT:-"`,
    "  exit 0",
    "fi",
    // A creation killed between init and commit would otherwise fail registration on every connect.
    'rm -rf "$DIR"',
    'mkdir -p "$DIR"',
    'LOG="$(mktemp)"',
    "trap 'rm -f \"$LOG\"' EXIT",
  ];
  for (const file of files) {
    if (!isSafeTemplatePath(file.path)) {
      throw new Error(`refusing to write sandbox template path "${file.path}" on a host`);
    }
    if (file.contents.split("\n").includes(HEREDOC)) {
      throw new Error(`sandbox template ${file.path} collides with the heredoc delimiter`);
    }
    const directory = posix.dirname(file.path);
    if (directory !== ".") lines.push(`mkdir -p "$DIR/${directory}"`);
    // The heredoc terminates the body with a newline, so a template file that ends with one
    // keeps its exact bytes.
    lines.push(
      `cat > "$DIR/${file.path}" <<'${HEREDOC}'`,
      file.contents.replace(/\n$/, ""),
      HEREDOC,
    );
  }
  lines.push(
    `if ! git -C "$DIR" ${GIT_IDENTITY} init -b main >"$LOG" 2>&1 ||`,
    `   ! git -C "$DIR" ${GIT_IDENTITY} add . >>"$LOG" 2>&1 ||`,
    `   ! git -C "$DIR" ${GIT_IDENTITY} commit -m "Seed the sandbox repository" >>"$LOG" 2>&1; then`,
    `  echo "${TOKEN_PREFIX}FAILED:$(tail -c 200 "$LOG" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    `echo "${TOKEN_PREFIX}READY:$(cd "$DIR" && pwd -P)"`,
    "",
  );
  return lines.join("\n");
}

export type SandboxRepoOutcome =
  | { kind: "ready"; path: string }
  | { kind: "git_missing" }
  | { kind: "failed"; detail: string };

/** Last `OTOMAT_SANDBOX:` token wins; null means the script never reported. */
export function parseSandboxRepoOutput(stdout: string): SandboxRepoOutcome | null {
  const token = lastToken(stdout, TOKEN_PREFIX);
  if (token === null) return null;
  const { detail } = token;
  switch (token.kind) {
    case "READY":
      return detail.startsWith("/") ? { kind: "ready", path: detail } : null;
    case "NO_GIT":
      return { kind: "git_missing" };
    case "FAILED":
      return { kind: "failed", detail: detail.trim() };
    default:
      return null;
  }
}

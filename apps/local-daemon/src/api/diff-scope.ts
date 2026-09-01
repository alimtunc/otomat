import type { RunDiffScopeSelector } from "@otomat/domain";
import type { Context, Env } from "hono";

import { DiffScopeNotFoundError } from "#review";

export class DiffScopeInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffScopeInvalidError";
  }
}

/** An absent scope is the branch, which is what the cockpit's default link omits. */
export function readDiffScope<E extends Env>(c: Context<E>): RunDiffScopeSelector {
  const query = (key: string): string | undefined => c.req.query(key);
  const kind = query("scope");
  if (kind === undefined || kind === "branch") return { kind: "branch" };
  if (kind === "commit") {
    const commit = query("commit");
    if (!commit) throw new DiffScopeInvalidError("A commit scope needs a `commit` sha.");
    return { kind: "commit", commit };
  }
  if (kind === "step") {
    const step = query("step");
    if (!step) throw new DiffScopeInvalidError("A step scope needs a `step` id.");
    return { kind: "step", step };
  }
  if (kind === "session") {
    const session = query("session");
    if (!session) throw new DiffScopeInvalidError("A session scope needs a `session` id.");
    return { kind: "session", session };
  }
  if (kind === "pull_request") return { kind: "pull_request" };
  throw new DiffScopeInvalidError(`Unknown diff scope \`${kind}\`.`);
}

export function diffScopeErrorResponse<E extends Env>(
  c: Context<E>,
  error: unknown,
): Response | null {
  if (error instanceof DiffScopeInvalidError) {
    return c.json({ error: "diff_scope_invalid", message: error.message }, 400);
  }
  if (error instanceof DiffScopeNotFoundError) {
    return c.json({ error: error.code, message: error.message }, 404);
  }
  return null;
}

import { WORKSPACE_DIFF_SCOPE, type RunDiffScopeSelector } from "@otomat/domain";

export interface DiffScopeSearch {
  scope?: "commit" | "session";
  commit?: string;
  session?: string;
}

export function readDiffScopeSearch(search: Record<string, unknown>): DiffScopeSearch {
  const scope = search["scope"];
  const commit = search["commit"];
  const session = search["session"];
  return {
    ...(scope === "commit" || scope === "session" ? { scope } : {}),
    ...(typeof commit === "string" ? { commit } : {}),
    ...(typeof session === "string" ? { session } : {}),
  };
}

/** A scope naming nothing usable falls back to the workspace instead of asking the daemon a question it cannot answer. */
export function toDiffScopeSelector(search: DiffScopeSearch): RunDiffScopeSelector {
  if (search.scope === "commit" && search.commit) {
    return { kind: "commit", commit: search.commit };
  }
  if (search.scope === "session" && search.session) {
    return { kind: "session", session: search.session };
  }
  return WORKSPACE_DIFF_SCOPE;
}

export function toDiffScopeSearch(selector: RunDiffScopeSelector): DiffScopeSearch {
  if (selector.kind === "commit") return { scope: "commit", commit: selector.commit };
  if (selector.kind === "session") return { scope: "session", session: selector.session };
  return {};
}

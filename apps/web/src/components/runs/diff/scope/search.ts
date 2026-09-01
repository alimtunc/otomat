import {
  BRANCH_DIFF_SCOPE,
  type RunDiffScopeParams,
  type RunDiffScopeSelector,
} from "@otomat/domain";

const SCOPE_KINDS = ["commit", "step", "session", "pull_request"] as const;

export type DiffScopeSearch = Partial<RunDiffScopeParams>;

function readScopeKind(value: unknown): DiffScopeSearch["scope"] {
  return SCOPE_KINDS.find((kind) => kind === value);
}

export function readDiffScopeSearch(search: Record<string, unknown>): DiffScopeSearch {
  const scope = readScopeKind(search["scope"]);
  const commit = search["commit"];
  const step = search["step"];
  const session = search["session"];
  const parsed: DiffScopeSearch = {};
  if (scope !== undefined) parsed.scope = scope;
  if (typeof commit === "string") parsed.commit = commit;
  if (typeof step === "string") parsed.step = step;
  if (typeof session === "string") parsed.session = session;
  return parsed;
}

/** A scope naming nothing usable falls back to the branch instead of asking the daemon a question it cannot answer. */
export function toDiffScopeSelector(search: DiffScopeSearch): RunDiffScopeSelector {
  if (search.scope === "commit" && search.commit) {
    return { kind: "commit", commit: search.commit };
  }
  if (search.scope === "step" && search.step) return { kind: "step", step: search.step };
  if (search.scope === "session" && search.session) {
    return { kind: "session", session: search.session };
  }
  if (search.scope === "pull_request") return { kind: "pull_request" };
  return BRANCH_DIFF_SCOPE;
}

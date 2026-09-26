import { DaemonRequestError } from "@otomat/client";
import {
  workspaceUpdateErrorSchema,
  type ComparedWorkspaceFreshness,
  type RemoteRefComparison,
  type UpdateWorkspaceRequest,
  type WorkspaceFreshness,
  type WorkspaceUpdateErrorBody,
  type WorkspaceUpdateStrategy,
} from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

interface FreshnessReading {
  data: WorkspaceFreshness | undefined;
  isError: boolean;
  isFetching: boolean;
}

export type FreshnessAcknowledgment = "stale" | "unchecked";

/** `key` is what an acknowledgment binds to: the same remote state keeps it, any change asks again. */
type FreshnessGate =
  | { kind: "checking" }
  | { kind: "clear" }
  | { kind: "acknowledge"; reason: FreshnessAcknowledgment; key: string };

/** A check that failed never clears the launch, even over an older answer that did. */
export function freshnessGate({ data, isError, isFetching }: FreshnessReading): FreshnessGate {
  if (isFetching) return { kind: "checking" };
  if (isError) return { kind: "acknowledge", reason: "unchecked", key: "unchecked" };
  if (data === undefined) return { kind: "checking" };
  if (data.state === "up_to_date") return { kind: "clear" };
  if (data.state === "unverifiable") {
    const key = `unverifiable:${data.failure.remote.failure}`;
    return { kind: "acknowledge", reason: "unchecked", key };
  }
  return {
    kind: "acknowledge",
    reason: "stale",
    key: [data.state, data.branch?.sha, data.base?.sha].join(":"),
  };
}

export function freshnessCleared(gate: FreshnessGate, acknowledged: string): boolean {
  return gate.kind === "clear" || (gate.kind === "acknowledge" && gate.key === acknowledged);
}

export const FRESHNESS_CHIPS = {
  up_to_date: { label: "Up to date", tone: "success" },
  behind: { label: "Behind the remote", tone: "warning" },
  diverged: { label: "Diverged from the remote", tone: "danger" },
  unverifiable: { label: "Remote not checked", tone: "neutral" },
} satisfies Record<WorkspaceFreshness["state"], { label: string; tone: StatusTone }>;

function commits(count: number): string {
  return count === 1 ? "1 commit" : `${count} commits`;
}

function branchLine(branch: RemoteRefComparison): string | null {
  if (branch.behind === 0) return null;
  const lacking = `${branch.ref} has ${commits(branch.behind)} this workspace does not`;
  return branch.ahead === 0
    ? `${lacking}.`
    : `${lacking}, and the workspace has ${commits(branch.ahead)} it does not.`;
}

function baseLine(base: RemoteRefComparison, branch: RemoteRefComparison | null): string | null {
  if (base.behind === 0) return null;
  const line = `${base.ref} gained ${commits(base.behind)} since this workspace last took it.`;
  return base.strategies.length === 0 && branch !== null
    ? `${line} Take ${branch.ref} first.`
    : line;
}

function upToDateLine({ branch, base }: ComparedWorkspaceFreshness): string {
  const refs = [branch?.ref, base?.ref].filter((ref) => ref !== undefined);
  return refs.length === 0
    ? "Neither the branch nor its base exists on the remote yet."
    : `The workspace carries everything ${refs.join(" and ")} hold.`;
}

export function freshnessDetails(freshness: ComparedWorkspaceFreshness): string[] {
  if (freshness.state === "up_to_date") return [upToDateLine(freshness)];
  const { branch, base } = freshness;
  return [branch && branchLine(branch), base && baseLine(base, branch)].filter(
    (line) => line !== null,
  );
}

interface FreshnessAction {
  request: UpdateWorkspaceRequest;
  label: string;
}

function actionLabel(comparison: RemoteRefComparison, strategy: WorkspaceUpdateStrategy): string {
  if (strategy === "rebase") return `Rebase onto ${comparison.ref}`;
  return comparison.ahead === 0 ? `Fast-forward to ${comparison.ref}` : `Merge ${comparison.ref}`;
}

export function freshnessActions({ branch, base }: ComparedWorkspaceFreshness): FreshnessAction[] {
  const sources = [
    { source: "branch", comparison: branch },
    { source: "base", comparison: base },
  ] as const;
  return sources.flatMap(({ source, comparison }) =>
    comparison === null
      ? []
      : comparison.strategies.map((strategy) => ({
          request: { source, strategy },
          label: actionLabel(comparison, strategy),
        })),
  );
}

/** Otomat aborted the operation; resolving it by hand starts from a fresh fetch, since the remote ref it took is not kept. */
export function conflictAdvice(strategy: WorkspaceUpdateStrategy, ref: string): string {
  const [remote = "origin"] = ref.split("/");
  const next = strategy === "rebase" ? "git rebase --continue" : "git commit";
  return `Try the other strategy, or resolve it yourself in the worktree's terminal: git fetch ${remote}, git ${strategy} ${ref}, fix the conflicts, then ${next}, and check again.`;
}

export function workspaceUpdateRefusal(error: unknown): WorkspaceUpdateErrorBody | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = workspaceUpdateErrorSchema.safeParse(error.body);
  return refusal.success ? refusal.data : null;
}

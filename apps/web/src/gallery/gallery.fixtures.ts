import type {
  EventSource,
  PullRequestContract,
  PullRequestDetail,
  RunDetail,
  RunState,
  StepRunState,
} from "@otomat/domain";

export interface SurfaceSwatch {
  varName: string;
  hex: string;
}

export const SURFACE_SWATCHES: SurfaceSwatch[] = [
  { varName: "--background", hex: "#0A0B0D" },
  { varName: "--sidebar", hex: "#0C0D10" },
  { varName: "--surface-1", hex: "#101216" },
  { varName: "--surface-2", hex: "#16181D" },
  { varName: "--surface-3", hex: "#1B1E25" },
  { varName: "--iris-solid", hex: "#5B7CFA" },
  { varName: "--success", hex: "#3FB950" },
  { varName: "--warning", hex: "#D8A12B" },
  { varName: "--danger", hex: "#F2545B" },
  { varName: "--review", hex: "#A371F7" },
  { varName: "--stale", hex: "#E0833B" },
];

export const PROVENANCE_SOURCES: EventSource[] = [
  "otomat",
  "claude",
  "codex",
  "git",
  "github",
  "linear",
  "system",
];

export interface AccentSwatch {
  hex: string;
  label: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { hex: "#5B7CFA", label: "Iris" },
  { hex: "#C08B3E", label: "Brass" },
  { hex: "#4FAE8B", label: "Viridian" },
  { hex: "#E0457B", label: "Rose" },
  { hex: "#A371F7", label: "Violet" },
];

export interface CardRunFixture {
  id: string;
  branch: string;
  added: number;
  removed: number;
}

export const CARD_RUN: CardRunFixture = {
  id: "r3",
  branch: "otomat/7-csv",
  added: 124,
  removed: 6,
};

export const MARKDOWN_SAMPLE = [
  "# Completion report",
  "",
  "The run finished. See [the diff](https://otomat.dev/runs/r3/diff) and *check* the",
  "**open comments** before merging.",
  "",
  "## Checks",
  "",
  "- [x] `pnpm check` is green",
  "- [ ] PR opened",
  "  - nested detail",
  "",
  "| Gate | State |",
  "| --- | --- |",
  "| `pnpm check` | passing |",
  "| deploy | ~~blocked~~ |",
  "",
  "> Evidence is persisted; nothing here is AI-authored narrative.",
  "",
  "```ts",
  'const branch = "otomat/run/a-very-long-branch-name-that-overflows-the-block-width";',
  "```",
  "",
  "---",
  "",
  "Plain text keeps its\nline breaks.",
].join("\n");

export const MARKDOWN_STREAMING_SAMPLE = [
  "Applying the **fix to `packages/",
  "",
  "```sh",
  "pnpm --filter @otomat/ui test",
].join("\n");

export const CONFIG_MENU_LONG_VALUE =
  "gpt-5.6-sol-preview-2026-08-01-extended-reasoning — from “Careful reviewer, escalating”";

export const CONFIG_MENU_SCROLLED_CHOICES = Array.from(
  { length: 42 },
  (_, index) => `release/2026-08-${String(index + 1).padStart(2, "0")}`,
);

export function runDetailFixture(
  status: RunState,
  steps: { id: string; status: StepRunState }[] = [],
): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "issue-1",
      status,
      branch: "otomat/run/run-1",
      plan_json: { version: 1, steps: [] },
      updated_at: "2026-08-30T10:00:00.000Z",
    },
    steps: steps.map((step, idx) => ({
      id: step.id,
      run_id: "run-1",
      idx,
      name: `Step ${String(idx + 1)}`,
      status: step.status,
      compete_group_id: null,
      worktree_id: null,
      branch: null,
      worktree_status: null,
      provider_wait: null,
      next_turn_config: null,
    })),
    sessions: [],
    compete_groups: [],
    worktree_path: null,
    base_branch: null,
    wait: null,
    resume: { mode: "unavailable", reason: "not resumable" },
    holds_workspace: false,
  };
}

export function pullRequestFixture(overrides: Partial<PullRequestContract>): PullRequestContract {
  return {
    id: "pr-1",
    issue_id: "issue-1",
    run_id: "run-1",
    provider: "github",
    origin: "otomat",
    provenance: "otomat",
    author_login: "alimtunc",
    review_decision: null,
    checks_state: "passing",
    mergeable: "mergeable",
    requested_reviewers: [],
    provider_updated_at: "2026-08-30T09:00:00.000Z",
    head_sha: "a1b2c3d4",
    attachment: null,
    number: 183,
    url: "https://github.com/alimtunc/otomat/pull/183",
    status: "open",
    publication_status: "created",
    title: "feat(shell): open projects in tabs with attention badges",
    body: "Opens each project in its own tab and badges the ones needing attention.",
    head_ref: "otomat/run/cfd42f6f",
    base_ref: "main",
    commit_subject: "feat(shell): open projects in tabs with attention badges",
    commit_body: null,
    generator: { runtime: "claude", model: "claude-opus-5", effort: "xhigh" },
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

export function pullRequestDetailFixture(
  pullRequest: PullRequestContract | null,
): PullRequestDetail {
  return {
    pull_request: pullRequest,
    sync: null,
    publishability: {
      blocker: null,
      repository: "alimtunc/otomat",
      base_ref: "main",
      head_ref: "otomat/run/run-1",
      changed_files: 3,
      additions: 124,
      deletions: 6,
      dirty: false,
    },
    operation: null,
  };
}

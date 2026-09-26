# Otomat linked issues and stacked pull requests — 2026-09-25

A design recommendation for showing and walking the relations between issues
(parent, sub-issues, blocking, related) and the order of stacked pull requests,
without confusing Linear's product hierarchy with GitHub's git dependency.
Planning evidence, not a product contract: validate against the live product
before implementing. Base: `main` at `da0705a2`. External facts come from the
vendors' public documentation listed in [sources](#sources).

Contents: [today](#1--what-otomat-models-today) ·
[Linear and GitHub compared](#2--linear-and-github-compared) ·
[three relations](#3--three-relations-three-sources-of-truth) ·
[recommendation](#4--recommendation-and-mvp) ·
[anatomy](#5--anatomy) · [interactions](#6--creation-modification-and-synchronization) ·
[edge cases](#7--edge-cases) · [prototype](#8--prototype) ·
[implementation outline](#9--implementation-outline).

## 1 — What Otomat models today

Otomat has **no issue-to-issue relation and no PR-to-PR relation**. The
mirrors, group headers, rail sections and PR cards a V1 builds on exist, and
two correctness gaps are already reachable. Daemon paths are relative to
`apps/local-daemon/src`.

| Concern | Today | Where |
| --- | --- | --- |
| Linear sync | Paged `issues(...)` selects `id identifier title description url updatedAt priority assignee labels state`; never `parent`, `children`, `relations`, `inverseRelations` | `linear/graphql/issue-sync.ts`, `shared.ts` |
| Sync trigger | On demand only: `POST /api/linear/sync`, called by the web when older than 60 s (project change, window focus, Issues list) and by **Refresh issues**; incremental on an `updatedAt` watermark minus 60 s, **Full resync** re-reads every issue; no webhook, no daemon poller; rows are never deleted | `linear/sync.ts`, `apps/web/src/api/linear/use-project-sync.ts` |
| Issue mirror | `issues`: one `project_id`, `source_*` columns (`source_labels` as JSON); no parent or relation column | `packages/db/src/schema/issues.ts` |
| Linear writes | `issueUpdate`, `commentCreate`, `attachmentLinkURL` through the `linear_writes` ledger; no `issueCreate`, no `issueRelation*` | `linear/graphql/issues.ts`, `comments.ts`, `attachments.ts`, `linear/writeback/` |
| "Further issues" on a step | `ContextReference { kind: "issue" }`, frozen in `runs.plan_json` for the prompt — a prompt reference, not a relation, never synced | `packages/domain/src/context/reference.ts`, `context/freeze.ts` |
| Base branch | Chosen at launch among local branches, frozen on `worktrees.base_ref` (the name) and `base_sha` (the remote tip, or the local tip when the remote lacks the branch; a branch with no upstream is refused when the repository has several remotes). A run can already fork from another run's branch; nothing records which run owns that base | `supervisor/launch-target.ts`, `apps/web/src/components/runs/launch/base/branch-control.tsx`, `git/acquire.ts`, `git/remote-base.ts` |
| PR target | A run's PR targets its worktree's frozen base; a repository publication from the project checkout targets the local branch chosen as Source control's *Target branch*. Otomat never retargets (`gh pr edit` changes title and body only) | `github/publication/workspace.ts`, `github/repository/publication.ts`, `github/cli/client.ts` |
| PR mirror | `pull_requests` keeps `head_ref`, `base_ref`, `head_sha`, `base_sha`, `status`, `provenance`; while Reviews is open, its pass mirrors each repository's 100 newest open PRs (`gh pr list` order), Otomat's or not, and re-reads live rows it no longer lists. `mergedAt` and the head repository are not stored | `packages/db/src/schema/pull-requests.ts`, `github/inbox/sync.ts`, `github/import/store.ts` |
| Base re-read | `mirroredColumns` (`base_ref` included, not `head_sha`/`base_sha`) is written on create, attach, adoption, repository publication and push, by the Reviews pass, the PR card's Refresh, the PR overview and the 5-minute pass on adopted rows, and by a republish only when it edits the PR. On a run's own PR the 5-minute pass and the run PR panel go through `refreshLifecycle`, which writes `status` only, so a retarget on GitHub can stay unseen. Only the Reviews pass and a repository publication stamp `synced_at` | `github/mirror.ts`, `github/refresh.ts`, `github/publication/publisher.ts` |
| Issues list | Flat groups (status, assignee, label, project, none): header rows in `VirtualTable` for List, columns for Board; saved views in `localStorage` | `apps/web/src/lib/issue/grouping.ts`, `apps/web/src/components/table/virtual-table.tsx` |
| Issue page | Main column plus rail: properties, Linear section, cycle, pull requests (`AttachedPullRequestCard`: `#N`, badge, `head → base @sha`) | `apps/web/src/components/issues/workspace/rail/workspace-rail.tsx`, `apps/web/src/components/pull-requests/attached-card.tsx` |

Two gaps a stack exposes today — each reachable by launching a run with
another run's branch as its **Base branch**, or by publishing the project
checkout against one:

1. **A merge into a stacked base closes the issue.** `reconcileLifecycle`
   (`github/publication/store.ts`) calls `closeMergedRun` on the transition to
   `merged`, and `settleLifecycle` (`github/import/store.ts`) calls
   `closeMergedIssue` whenever a mirrored row linked to an issue is `merged`,
   whatever `base_ref` is; both end in `markIssueDone`
   (`supervisor/merge-closure.ts`). B's PR targets `feat/a`; once it merges, B's
   run completes and its issue goes to `done` in Otomat and in Linear although
   the code only reached `feat/a`. Otomat merges without `--delete-branch`, so
   unless GitHub's *Automatically delete head branches* removes `feat/a`, B
   keeps targeting it after A lands (§2) and can be merged into a branch nothing
   will merge again.
2. **Cleanup can delete a stack's base.** Every cleanup of A's workspace — the
   merge closure when *Automatically delete this project's workspaces after
   merge* is on, a row delete, or *Clean up merged worktrees* — runs
   `git branch -D feat/a` (`supervisor/workspaces/cleanup.ts`, `git/branches.ts`)
   without checking that B's worktree was forked from it. B's diff then forks
   from `refs/remotes/<remote>/feat/a` or the recorded `base_sha`
   (`git/repo.ts`, `git/diff-inputs.ts`); an unpushed B's publication
   comparison runs `git log feat/a..HEAD` and degrades to *unavailable*
   (`github/publication/sync.ts`).

## 2 — Linear and GitHub compared

**Linear** ([parent and sub-issues](https://linear.app/docs/parent-and-sub-issues),
[issue relations](https://linear.app/docs/issue-relations),
[GitHub integration](https://linear.app/docs/github)):

- *Parent / sub-issues* (`Issue.parent`, `Issue.children`): a sub-issue
  inherits the parent's team, priority and project when created. Optional team
  automations mark the parent done when every sub-issue is done and mark the
  remaining sub-issues done when the parent is done. Sub-issue order is per
  user, not global.
- *Relations* (`IssueRelation { type, issue, relatedIssue }`, read from both
  `relations` and `inverseRelations`): `blocks` (its inverse is "blocked by"),
  `related`, `duplicate`, plus `similar`, which only the API enum lists.
  `IssueRelation.type` is a `String!`, not that enum. Mentioning an issue in a
  description or comment creates `related` automatically. Once a blocker is
  resolved, Linear shows the relation under *Related*. A duplicate moves to the
  reserved Duplicate status, which Otomat already maps to `canceled`. API users
  report, and the docs do not say, that a pair holds one edge:
  `issueRelationCreate` on a pair that already has one converts it rather than
  adding a second.
- *PRs*: linked by magic words (closing, non-closing, or "relates to", which
  changes no status) or by the identifier in the branch name or PR title;
  several PRs per issue, the status moves when the last one reaches the
  configured state; automations can depend on the target branch. The
  integration describes **no PR order**.

**GitHub** ([about stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[APIs and webhooks](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-rest-and-graphql-apis),
[Stacks REST API](https://docs.github.com/en/rest/pulls/stacks),
[changelog, 2026-07-30](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)):

- *Manual chain*: any PR whose base is another PR's head. Nothing binds the two
  beyond branch names. When a merged PR's head branch is deleted, GitHub
  retargets the open PRs based on it to the merged PR's base
  ([merging a pull request](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request));
  when the branch is kept, they keep targeting it.
- *Native stack* (public preview since 2026-07-30): explicit membership, same
  repository only (no cross-fork stacks); each PR's base ref must equal the
  previous PR's head ref. A stack map in the merge box shows every layer and
  its status. Merging a mid-stack PR merges the layers below it; the layers
  above stay open and are rebased and retargeted to the stack's base. Merging
  the top merges the whole stack. A stack cannot be merged through the legacy
  synchronous merge endpoints or mutations, only the asynchronous merge
  endpoint. REST `/repos/{owner}/{repo}/stacks` lists, reads, creates, extends
  and unstacks; GraphQL exposes read-only `stack` and `stackEntry` on
  `PullRequest`; `pull_request` webhook payloads carry `stack`; the `gh stack`
  extension drives the local flow.

| | Linear sub-issues | Linear blocking | GitHub stack |
| --- | --- | --- | --- |
| Answers | what is this part of? | what must finish first? | which change sits on which? |
| Unit | issue | pair of issues | pull request / branch |
| Shape | tree | graph (cycles not excluded by the docs) | chain; manual chains can fan out |
| Order | none (per-user sort) | partial | total, bottom → top |
| Closes | optional auto-close either way | nothing; display moves to *Related* | merging lands lower layers, upper ones retarget |

The columns are independent: a sub-issue need not be stacked, a stack layer
need not be a sub-issue, one issue can own several PRs, and one stack can
carry unrelated issues. A blocking relation *suggests* a stack order but never
proves one.

## 3 — Three relations, three sources of truth

- **Hierarchy** — parent and sub-issues: how the product work is decomposed.
  Truth: Linear `parent`. Otomat mirrors it read-only.
- **Work dependency** — blocks / blocked by, plus the associations *related*
  and *duplicate*. Truth: Linear relations. Otomat reads them live.
- **Change order** — the stack: which PR's base is which PR's head, in one
  repository. Truth: GitHub `baseRefName`/`headRefName` (and the native stack
  when one exists). Before a PR exists, Otomat's own evidence is a
  `worktrees.base_ref` naming another run's branch; it is shown as "forked from
  OTO-229's branch", never as a stack.
- **Local grouping** — saved views and the choice to group by parent are view
  configuration, never written back; the parent itself is Linear's.
- **Not relations** — step context references, `Refs`/`Fixes` footers (one PR
  ↔ one issue, already shown), shared labels or projects.

Rules every surface keeps:

1. A relation is shown only from its source. Otomat never infers one — not from
   a mention, a branch name, a shared label, or a "blocked by" read as a stack.
2. Every relation section names its source and freshness (*Linear · 2 min ago*,
   *GitHub · 5 min ago*).
3. Sub-issues and stack layers never share a list: issue rows carry issue
   glyphs and identifiers; stack layers carry PR glyphs, numbers and branch
   names, with the issue identifier as a secondary link.
4. No derived status. A Linear "blocked by" does not put the issue in Otomat's
   own `blocked` issue state; the blocker's row shows the blocker's own state.

## 4 — Recommendation and MVP

**Implement, as two independent tickets, in this order. Defer every write.**

| | A · Stack safety and stack strip (GitHub) | B · Linear relations, read-only |
| --- | --- | --- |
| Why now | Fixes the two gaps of §1, reachable today through the Base branch combobox and repository publication | Answers "what goes together / what blocks what" where the operator launches work |
| Relations | PR order derived from mirrored `base_ref`/`head_ref` | parent, sub-issues, blocks, blocked by, related, duplicate of |
| Views | stack strip in the PR card and the PR overview; launch hint | *View options → Group → Parent* in Issues; "Sub-issue of" line and *Relations* rail section on the issue page |
| Defer it when | never defer the safety half (merge guard, closure rule, cleanup guard, base refresh); the strip can wait if nobody stacks | the team rarely uses sub-issues or blocking on Otomat-driven work — the cost is one sync field, one live query, one rail section and one grouping |

Supported in V1:

| Relation | Shown |
| --- | --- |
| Parent / sub-issues | list grouping, issue header, rail |
| Blocks / blocked by | rail |
| Related | rail, collapsed |
| Duplicate of | issue header |
| Similar | — |
| Stack order | PR card, PR overview, merge panel |
| Forked from a run | launch form |

Behaviour changes that ship with A:

- **Closure rule.** A merged PR whose `base_ref` is the head of another PR
  Otomat mirrors, whatever its state, completes its run — there is nothing
  left to publish — but does **not** drive the issue to `done` nor signal
  Linear; its PR card reads "merged into `feat/a`" from the row's `base_ref`.
  Every other merge closes as today, so a repository whose trunk is not the
  default branch keeps working. Rejected: closing B transitively when A later
  lands in the trunk — correct, but it needs a durable walk over merged
  history for a case a Linear status covers.
- **Merge guard.** The merge panel refuses a PR whose base is another open PR's
  head (*"#41 sits below this PR — merge it first"*), a merged PR's head
  (*"#41 is merged — retarget this PR to `main` on GitHub"*) or a closed PR's
  head (*"#41 was closed — retarget this PR on GitHub"*), and any PR in a base
  loop (*"These pull requests target each other"*), as a new `stacked_base`
  value of `PullRequestMergeBlocker`.
- **Cleanup guard.** Workspace cleanup keeps a local branch that another live
  worktree's `base_ref` names and says so (*"kept: OTO-231's workspace is forked
  from it"*).
- **Base refresh.** `refreshLifecycle` mirrors `mirroredColumns`, not only
  `status`, and every refresh path stamps `synced_at`, so a retarget — a native
  stack's included — shows within one pass with its freshness.

Deferred, with the signal that reopens each:

- Editing a parent or a relation from Otomat (`issueUpdate.parentId`,
  `issueRelationCreate`/`Delete` through `linear_writes`) — when operators ask;
  the reported one-edge-per-pair conversion (§2) must be confirmed and surfaced
  before any write.
- Creating sub-issues from Otomat — needs `issueCreate`, which Otomat lacks.
- A *blocked* flag on list rows and a "blocked by" filter — needs relations in
  the paged sync; measure Linear query complexity and confirm whether a relation
  edit moves `updatedAt` first.
- Nested tree rows (a parent row expanding its sub-issues, several levels) —
  under status grouping a nested sub-issue would sit in its parent's status
  group instead of its own, and it needs tree keyboard handling inside
  `VirtualTable`.
- A dependency graph, cross-host aggregation of relations.
- Restack, rebase or retarget from Otomat; native stack create/extend
  (preview API); showing the native stack number.
- Ordering or gating launches by "blocked by" — that would be a scheduler, which
  the daemon deliberately does not have.

## 5 — Anatomy

The [prototype](#8--prototype) renders the Issues list and the issue page on
the product's tokens. Sketches:

**Issues list — View options → Group → Parent** (one level; List shows header
rows, Board shows one column per parent):

```
▾ ◔ OTO-228  Linked issues and stacked PRs          In Progress   0/4 done
    OTO-229  Mirror the Linear parent            pr open
    OTO-231  Relations rail section              running
    OTO-232  Group issues by parent              ready
    OTO-233  Stack strip in the PR card          reviewing
▾ ◔ PLT-12  Sync hardening   not synced here ↗                 0/1 done
    OTO-240  Retry the Linear sync on rate limits   ready
▾ No parent                                                        3
```

Rows keep today's anatomy; nothing new is added to a row. The header counts
the Linear state of the sub-issues mirrored in this project, and its tooltip
says so. A parent the mirror lacks (another team) is drawn from the stored
`source_parent` with a Linear link and no Otomat chip.

**Issue page — header line and rail** (issue OTO-231, after #41 merged with
its branch kept):

```
OTO-231 · Relations rail section                      [Open cockpit] [Launch]
● running · Linear In Progress
Sub-issue of OTO-228 Linked issues and stacked PRs

┌ RELATIONS                              Linear · 2 min ago  [Open in Linear ↗] ┐
│ Parent       ◔ OTO-228  Linked issues and stacked PRs         In Progress     │
│ Blocked by   ● OTO-229  Mirror the Linear parent              Done            │
│ Blocks       ◔ OTO-233  Stack strip in the PR card            In Review       │
│ Related · 1  ▸                                                                 │
└───────────────────────────────────────────────────────────────────────────────┘
┌ PULL REQUESTS                                          GitHub · 4 min ago      ┐
│ #42 Relations rail section                open    otomat                      │
│ feat/relations-rail → feat/mirror-parent                                      │
│ STACK                                                                          │
│   ○ main                                                                       │
│   ├ #41 feat/mirror-parent       merged   OTO-229                             │
│   ├ #42 feat/relations-rail      open     OTO-231   ← this PR                 │
│   └ #43 feat/stack-strip         draft    OTO-233                             │
│ ⚠ #41 is merged but this PR still targets feat/mirror-parent.                 │
│   Retarget it to main on GitHub before merging.                   [GitHub ↗]  │
└───────────────────────────────────────────────────────────────────────────────┘
```

- *Relations* sits directly after the Linear section, before *Cycle details*,
  under the same Linear-issue gate. Its rows reuse `IssueLabel` (mono
  identifier, truncated title) with the Linear state dot and name. A mirrored
  target links to its Otomat page; an unmirrored one links to Linear with an
  external-link icon and the tooltip *Not synced on this host*. *Sub-issues*
  shows the first 5, then *Show all* expands in place. *Related* is
  collapsed. The section is hidden when Linear returns no relation. From a
  sub-issue, its siblings are one hop away through the parent's *Sub-issues*;
  V1 adds no previous/next stepper.
- *Stack* lives **inside** the PR card, bottom to top from the trunk, one line
  per layer: PR glyph and `PRStatusBadge`, `#N`, head branch (mono), linked
  issue identifier as a secondary link, and the provenance chip when the PR is
  not Otomat's. It appears only when the PR's base is another mirrored PR's
  head or its head is another PR's base. The same component sits above the
  merge panel on `/pull-requests/:id/overview`.
- The launch form's Base branch control adds one line when the chosen branch
  belongs to another open run: *"Forked from OTO-229's branch · #41"*.

## 6 — Creation, modification and synchronization

| | Create | Modify / remove | Synchronize | Errors and limits |
| --- | --- | --- | --- | --- |
| Parent / sub-issues | in Linear, through *Open in Linear* | in Linear | parent: the next incremental sync (§1), or **Full resync**; children: live on page open and window focus | Linear unavailable → rail keeps the mirrored parent and states the cause the project's Linear panel shows (no connection chosen, key not on this host, refused); fetch failed with data retained → data behind the stale notice with Retry; failed with no data → error state with Retry; more than 50 children → first 50 plus *Show all in Linear* |
| Blocks / related / duplicate | in Linear | in Linear | live on page open and window focus | same as above; archived targets are not returned and are not shown |
| Stack | launch a run with another run's branch as Base branch, publish the project checkout against it, or on GitHub (UI, `gh stack`) | retarget or reorder on GitHub | Reviews pass (≤120 s while Reviews is open), 5-minute pass, Refresh on the PR card | GitHub unreachable → last mirrored bases with their sync time |
| Parent grouping | *View options → Group → Parent* | same | none: view config in `localStorage` and the URL | a saved view grouping by parent on a project without Linear shows everything under *No parent* |

Otomat writes no relation, so there is no conflict to resolve: every relation
shown reads *as of* its source time. The relations read is a query — it neither
upserts the mirror nor triggers a sync.

## 7 — Edge cases

| Case | Behaviour |
| --- | --- |
| Relation changed in Linear | Page: next open or focus shows it. List: the parent moves at the next sync; a parent change is an issue field, so it is expected to move `updatedAt` (to confirm) |
| PR retargeted or stack edited on GitHub | The next GitHub pass (§6) mirrors the new `base_ref`; the strip redraws from it |
| Related issue not mirrored (unmapped team or Linear project, other workspace impossible — relations stay inside one workspace) | Unmirrored row (§5) |
| Related issue in another project on this host | Otomat link with a project tag |
| Related issue on another host | Treated as not mirrored; no cross-host lookup in V1 (the same issue can already be worked on two hosts — a separate gap) |
| Issue moved to another team | Linear changes its identifier; relations are keyed by Linear id and show the current identifier |
| Issue moved out of the mapped team | Its mirror row stays and stops syncing — unless another project here maps the new team, whose sync moves the row; relation rows show Linear's current identifier and link to Linear, not to the stale Otomat row |
| Stack layers on two hosts | Each host draws the strip from its own repository-wide PR mirror; the cleanup guard and the launch hint see only that host's worktrees |
| External PR in the chain | Layer shown with its provenance chip; merge rules unchanged (Otomat merges only its own or the viewer's PRs) |
| Cross-fork PR | Excluded from the chain: GitHub does not stack across forks. A fork's `head_ref` can collide with a run's branch, which already makes `classifyProvenance` mark it `otomat` and the merge panel accept it (`github/import/provenance.ts`, `github/merge-availability.ts`); `head_cross_repository` fixes both |
| Two PRs on one base (manual fan-out) | The strip shows the direct line and *Also on `feat/a`: #44*; no tree |
| Cycle | Linear blocking both ways: one hop is rendered, no transitive walk, so it is harmless. PR base/head loop: the walk keeps a visited set, stops, and shows *These pull requests target each other*, plus the merge guard. Parent grouping is one level |
| Lower PR merged, branch deleted | GitHub retargets the upper PR; the next pass shows the new base, and the merged layer leaves the strip once no open PR targets it |
| Lower PR merged, branch kept | Manual chain: upper still targets it — warning plus the merge guard. Native stack: GitHub already rebased and retargeted it at merge, as above |
| Native-stack PR merged from Otomat | Otomat merges with `gh pr merge` (`github/cli/merge.ts`); whether that reaches the legacy synchronous path GitHub refuses for stacks is unverified — test before A ships, and relay GitHub's refusal rather than retrying |
| Lower PR closed unmerged | *#41 was closed; this PR still targets its branch*, plus the merge guard |
| Base branch deleted without merge | *Base branch `feat/a` no longer exists on GitHub*; opening a new PR on it fails with the existing `github_base_branch_missing` |
| Lower workspace cleaned after merge | The cleanup guard (§4) |
| Squash-merged lower layer | Manual chain: the upper PR shows the lower commits until rebased; the merge panel's existing `conflicting` / `behind_base` blockers apply; no restack in V1. Native stack: GitHub rebases the upper layers itself |
| Local issue | No *Relations* section; the stack strip still applies (PRs are GitHub facts) |

## 8 — Prototype

[`prototype.html`](prototype.html) is self-contained (no network, no build).
It renders one Linear parent with four sub-issues, a parent from another team,
a blocking chain, an unmirrored related issue, a three-layer stack and an
external PR on the product's tokens.

| Criterion | In the prototype |
| --- | --- |
| Supported relations and their source | *Relations* (Linear mark, freshness) and *Stack* (GitHub mark) are separate sections; *Open in Linear* is the only edit path |
| Walk a group from the list and from the issue | *Group → Parent* in the list, with `↑` `↓` `Enter`; header line and rail rows on the issue page link back and forth |
| A stack is not sub-issues | stack layers are PRs and branches; the same issues appear as sub-issues in one section and as layers in another, never merged |
| Interactions and errors | the simulation bar's scenarios; the Merge button states each simulated refusal |
| Decide without external writes | no control writes anything; every edit is an outbound link |

It deliberately omits filters, saved-view tabs, the board layout and the
narrow layout — the product already has them — and the launch hint, the PR
overview and the *Duplicate of* line, which reuse the pieces shown.

## 9 — Implementation outline

**A · Stack safety and strip**

- Domain: a pure `projectPullRequestStack` projection over one repository's
  PR rows — ordered layers, fan-out siblings, warnings, cycle guard; the
  `stacked_base` merge blocker.
- DB: `head_cross_repository` on `pull_requests`, with a generated migration.
- Daemon `github`: `refreshLifecycle` mirrors `mirroredColumns` and every
  refresh path stamps `synced_at`; `isCrossRepository` in the `gh` JSON fields,
  the parser, `mirroredColumns` and `classifyProvenance`;
  `readPullRequestOverview` passes the repository's live PR rows to
  `mergeAvailability` for `stacked_base`.
- Daemon `supervisor`: the closure rule in `merge-closure.ts` — both lifecycle
  callers pass whether the base is a mirrored PR's head, and a stacked merge
  skips `markIssueDone`; the cleanup guard on `base_ref`.
- API: the stack rides the existing PR payloads; no new route.
- Web: `PullRequestStack` in `components/pull-requests/`, used by
  `AttachedPullRequestCard` and the PR overview; the launch hint in the Base
  branch control.
- Docs: `docs/ai/codebase-map.md` (*Publishing to a Pull Request*, *Adopting a
  Pull Request Otomat Did Not Open*, *The Pull Request Reviewer*, *Linear
  Run-Lifecycle Mirror*, *Reconciling and Cleaning Workspaces*),
  `apps/docs/guide/review.md`, `apps/docs/guide/workspaces.md`.
- Tests: projection (chain, fan-out, loop, merged or closed base, cross-fork),
  closure rule, merge blocker, cleanup guard.

**B · Linear relations**

- Daemon `linear`: `parent { id identifier title url }` in the paged sync,
  stored as a `source_parent` JSON column whose migration clears the Linear
  issue cursors so the next pass re-reads every row; an `OtomatIssueRelations`
  query (`parent`, `children(first: 50)`, `relations(first: 50)`,
  `inverseRelations(first: 50)`, each node with `id identifier title url
  state { type name color }`); `GET /api/linear/issues/:id/relations`, served
  by `deps.linear` beside the issue's comments, resolving each node against the
  mirror.
- Domain: one `IssueRelationKind` union (`parent`, `child`, `blocks`,
  `blocked_by`, `related`, `duplicate_of`); the daemon parses Linear's string
  `type` into it and drops `similar` and unknown values; `source_parent` on the
  issue contract (null for local issues) and on the summary, carrying the
  parent's resolved local id since summaries omit `source_external_id`.
- Client and web: `useIssueRelations`; a `RelationsSection` in the rail; the
  header line; `parent` in `ISSUE_GROUPING_OPTIONS`.
- Docs: codebase-map (*Linear Issue Freshness*, *Saved Issue Views*) and
  `apps/docs/guide/projects.md`.

## Sources

Consulted 2026-09-25: Linear —
[Parent and sub-issues](https://linear.app/docs/parent-and-sub-issues),
[Issue relations](https://linear.app/docs/issue-relations),
[GitHub integration](https://linear.app/docs/github),
[Edit issues](https://linear.app/docs/editing-issues). GitHub —
[About stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[Stacked pull requests APIs and webhooks](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-rest-and-graphql-apis),
[REST endpoints for stacks](https://docs.github.com/en/rest/pulls/stacks),
[Changelog 2026-07-30](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/).

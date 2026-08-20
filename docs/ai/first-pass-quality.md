# First-pass quality workflow

Status: adopted for Otomat after the OTO-128 pilots on 2026-08-19 and
2026-08-20.

This workflow reduces avoidable cleanup in the first implementation pass without
making every ticket pay for a large review. Repository conventions remain in
[`AGENTS.md`](../../AGENTS.md); reusable process remains in Agent Skills; syntax
and shape rules remain in the project gate.

## Decision matrix

Context cost is the text loaded when the candidate runs, measured on the audited
local copy where one existed. It excludes ordinary repository context and tool
output.

| Candidate | Source and reputation | Trigger and scope | Phase and overlap | Context cost and portability | Measurable value | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Matt Pocock `improve-codebase-architecture` | [Public MIT repository](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) from a known TypeScript educator; active but external and unpinned here | Human-requested architecture initiative; scans hotspots, produces an HTML report, then grills a selected direction | Post-hoc architecture exploration; overlaps SoC, ownership and YAGNI, not routine implementation | About 911 words locally, plus subagent/browser/CDN dependencies; basic prose is portable but the workflow is harness-dependent | Candidate count and accepted deepening proposals, not first-pass ticket defects | Reject from the daily stack; use only for an explicit architecture initiative |
| Vercel `react-best-practices` | [Official Vercel Engineering collection](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices); its metadata declares MIT, but the audited repository had no root licence text | React/Next performance work: waterfalls, bundle size, server/client fetching and rerenders | Authoring and review reference; overlaps local React rules but is much broader and performance-led | About 948 words before its 70 progressive rule files; the compiled `AGENTS.md` exceeds 13,000 words and many rules assume Next.js | Waterfalls, bundle deltas and measured rerenders on representative diffs | Reject daily installation; load selected rules only for a measured React performance task |
| `anti-slop` Oxlint rules | [Public MIT project](https://github.com/dmmulroy/anti-slop), vendored and reviewed by Otomat in OTO-119 | Every `pnpm lint` and `pnpm check`; rejects low-evidence TypeScript patterns | First-pass mechanical gate; complements rather than replaces judgment rules | Zero prompt cost; repo-owned and identical for every harness | Deterministic lint violations | Adopt always; keep the reviewed subset and the repo-owned comment-reference rule, never auto-sync upstream |
| Native Oxlint `react` / `jsx-a11y` / `vitest` plugins | [Built into the pinned Oxlint binary](https://oxc.rs/docs/guide/usage/linter/plugins), so no extra engine or package is required | Stack-specific deterministic lint; enable only explicitly selected rules | First-pass gate; turns part of the React/test/a11y prose into diagnostics | Zero prompt cost and cross-harness; full presets expose substantial legacy debt | New diagnostics, runtime and baseline size | Adopt the clean 15-rule React subset; defer full React, a11y and Vitest presets until their baselines are cleaned |
| Knip | [Active ISC project](https://github.com/webpro-nl/knip) with documented [gradual adoption](https://knip.dev/guides/adopt-gradually) | Workspace graph audit for unused files, exports and dependencies | Mechanical complement to intra-file `no-unused-vars`; directly targets consumerless code | Zero prompt cost after configuration; adds a dependency and monorepo entrypoint calibration | Dead files/exports/dependencies and scan duration | Pilot next, workspace by workspace; do not gate until dynamic/generated entrypoints have a reviewed baseline |
| React Doctor | [Active React scanner](https://github.com/millionco/react-doctor) with changed-scope and machine-readable output | Pinned code-quality lint on changed React diagnostics | First-pass differential gate; Bugs and Accessibility complement the native rules while Performance, Maintainability and exact duplicates stay disabled | Zero prompt cost; pinned `0.9.12`, local-only, no score, telemetry, supply-chain request or remote playbook; its [licence](https://github.com/millionco/react-doctor/blob/main/LICENSE) limits separate model training/evaluation uses | New unique diagnostics and gate duration | Adopt as a code lint only through `pnpm guard:react`; never use its output as model training or benchmark data |
| Addy Osmani `code-review-and-quality` | [Public review skill](https://github.com/addyosmani/agent-skills/blob/main/skills/code-review-and-quality/SKILL.md), widely installed through skills.sh | Broad five-axis review before merge | Post-review; strongly overlaps the local final pass and Turkit review skills | Large review context and another rubric to reconcile across harnesses | Review findings and corrections | Reject from first pass; use the local targeted review path instead |
| `rules-refresh` | Turkit user-invoked governance skill, audited from the installed source | Only when a rules document changes; classifies and sharpens rules against a shared baseline | Authoring-time maintenance; deliberately overlaps `AGENTS.md` while editing it | About 1,699 words with its baseline, zero permanent model context; output is cross-harness | Ambiguous, stale, redundant and missing rules found per edit | Adopt only for rules changes |
| `writing-for-agents` | Turkit model-invoked reference, audited from the installed source | Any `AGENTS.md`, `CLAUDE.md` or skill edit | Authoring-time information hierarchy; no code-quality rubric overlap | About 1,806 words when triggered plus a short permanent description; principles are cross-harness | Duplicate meanings removed, pointers sharpened, loaded words avoided | Adopt only for agent-document changes |
| `codebase-design` | Turkit model-invoked design vocabulary derived from deep-module principles | A ticket designs or restructures a module interface, seam or adapter | First-pass planning; deepens SoC, ownership and YAGNI without reviewing every diff | About 865 words when triggered; concepts are portable, invocation requires the skill on each harness | Interface surface, caller count, adapter count and tests through the seam | Adopt conditionally for genuine design work |
| `react-review` | Turkit user-invoked React 19 rubric plus a configurable mechanical gate | A significant React diff changes hooks, data flow, effects or render structure | Post-implementation specialist review; overlaps local React and ownership rules but adds behavioral checks | About 1,910 words plus gate output; `pnpm lint:react` is now pinned and portable | Required React changes and native Oxlint findings | Keep the judgment review operator-gated; let the ticket flow run the mechanical gate early only when React changed |
| `pre-pr-review` | Turkit user-invoked branch review, audited from the installed source | Before opening or materially updating a PR | Post-review of branch intent, commits and full diff; heavy overlap with `pnpm check` and the final diff pass | About 3,136 words plus full branch evidence; Git and project commands are portable | Cross-commit findings and residual required changes | Keep operator-gated before PR, outside first pass |
| `thermo-nuclear-code-quality-review` | Turkit user-invoked strict review with no pinned external provenance in the local manifest | Explicit unusually harsh maintainability audit | Heavy post-review; duplicates local SoC, DRY, ownership and over-engineering rules and encourages broad restructuring | About 1,922 words plus a deep review; prose is portable but its 1,000-line threshold conflicts with Otomat's 250-line gate | Structural findings, with high review cost and scope risk | Reject from the normal workflow; explicit exceptional audit only |
| `improve` | Turkit read-only advisor skill; local manifest attributes version 1.0.0 to shadcn under MIT | Whole-codebase audit and self-contained plans for other agents | Planning initiative, not ticket implementation; much broader than first-pass quality | About 2,278 words before playbooks and subagents; degrades without subagents but contains harness-specific execution branches | Prioritized codebase findings and plan completion | Reject from the ticket flow; retain for separate audits |
| Targeted final self-review | Repo-local `first-pass-quality`, existing `ticket` workflow and `AGENTS.md` final diff pass | Every implementation, after targeted checks and before the full gate | First-pass completion; directly checks the judgment gaps lint cannot prove | About 170 body words loaded on activation plus a short description; the same selected profile body reaches Claude and Codex | New comments, ownership/SoC, duplication, consumerless abstractions and corrections before handoff | Adopt always |

The source reputation column is a provenance signal, not proof of local value. No
external candidate is installed merely because it is popular.

## Portability and activation

The repo skill follows the open [Agent Skills specification](https://agentskills.io/specification):
name and description are discovered first, and the body loads only when the skill
fires. [Codex documents](https://learn.chatgpt.com/docs/build-skills) the same
progressive-disclosure model for `.agents/skills`; [Claude Code](https://code.claude.com/docs/en/skills)
supports the standard through its own skill surface. Inside Otomat, project skill
discovery covers both `.agents/skills` and `.claude/skills`, while the selected
profile freezes the body and supplies it identically to Claude and Codex. One
canonical `.agents` copy is exposed to Claude through the repository's
`.claude/skills/first-pass-quality` symlink. Otomat resolves both paths to the
same file before cataloguing it, so standalone Claude, Codex and profile-driven
Otomat runs share one body without duplicate instructions.

## Minimal stack and triggers

### Every implementation

1. Activate/select the repo-local `first-pass-quality` skill for implementation
   profiles. It points to `AGENTS.md` as the canonical repository contract rather
   than repeating its rules.
2. During planning, search for the owning module and reusable code before adding a
   new helper, schema, component or abstraction.
3. Implement against existing libraries and seams, running the narrowest useful
   test after each acceptance criterion.
4. Re-read the complete diff using
   [`AGENTS.md`'s final diff pass](../../AGENTS.md#final-diff-pass-mandatory), fix
   each violation, run `pnpm guard:react` early when React changed, then run
   `pnpm check`, which repeats every authoritative gate.
5. Report the number of new comments and justify every retained one. A clean result
   is `New comments: 0`.

The mechanical layer is the vendored anti-slop configuration documented in
[`codebase-map.md`](codebase-map.md#anti-slop-lint-rules-oto-119), plus the
ownership guardrails exercised by `scripts/guardrails.test.mjs`. It remains in the
normal project gate and adds no prompt tokens. The repo-owned
`no-ephemeral-comment-references` rule rejects ticket and PR references in source
comments with a zero-finding baseline, and its fixtures prove that boundary.

### Conditional additions

- Invoke `codebase-design` before editing only when the ticket introduces or moves
  an interface, seam or adapter. A file count alone is not an architecture trigger.
- Invoke `rules-refresh` and `writing-for-agents` together only when changing
  `AGENTS.md`, `CLAUDE.md` or a skill. The former tests the rules; the latter keeps
  one source of truth and controls context load.
- Run `pnpm guard:react` whenever React files changed. It composes the native
  zero-baseline rules with React Doctor's changed-scope Bugs and Accessibility
  delta. Offer the judgment-heavy `react-review` only when hooks, effects,
  query/mutation flow or render ownership changed.
- Load selected Vercel React rules only for a measured performance problem; never
  load its compiled all-rules document for ordinary Vite work.
- Pilot Knip separately on explicit workspace entrypoints before considering a
  dead-code gate. React Doctor remains a code lint: do not feed its output into
  model training, model evaluation or the cross-harness benchmark.
- Offer `pre-pr-review` only before PR publication or after a meaningful branch
  rewrite. Do not run it during routine implementation.
- Run Matt Pocock's architecture workflow, `thermo-nuclear` or `improve` only on
  an explicit separate audit request.

`goal-review` and reviewer subagents are never automatic. The short self-review is
part of implementation; a second reviewer is escalation based on risk or evidence.

## Why the rules stay small

The `rules-refresh` pass kept the existing DRY, SoC, ownership, over-engineering,
idiomatic React, error and type rules. It sharpened only the comment policy: write
the durable, non-obvious reason alone, without a tracker identifier or change
history, treat exact requested prose as input to sanitize rather than an exception,
and keep the result to one line. One example resolves the observed ambiguity over
an identifier in a comment prefix. The repo-owned lint rule detects the part syntax
can prove; the skill owns the reusable sequence; the remaining candidate guidance
stays behind conditional pointers.

This follows `writing-for-agents`: repository facts have one durable owner,
workflow branches load only when they fire, and a document points to executable
configuration instead of caching it in prose.

## Existing evidence and gap

The current repository already proves the deterministic parts:

- `scripts/guardrails.test.mjs` pressure-tests source size, component/hook export
  ownership, barrel purity and domain-folder structure.
- `scripts/anti-slop.test.mjs` proves that issue/PR references are reported while
  durable technical references such as ISO-8601 and `SAFETY:` remain legal.
- `pnpm lint:react` runs 15 native rules with zero baseline diagnostics and no
  performance or experimental React Compiler rule; `scripts/react-lint.test.mjs`
  proves a render-time state update fails while an event-driven update passes.
- `pnpm guard:react` adds pinned React Doctor diagnostics only for issues introduced
  against `main`. `doctor.config.json` disables the three excluded categories,
  13 overlapping rules already enforced by the native layer, remote scoring,
  supply-chain requests and
  dead-code analysis. `scripts/react-doctor.test.mjs` proves the exclusions and a
  unique render-time ref mutation finding.
- `apps/local-daemon/tests/agents/prompt.test.ts` proves profile guidance and skill
  instructions are composed, while runtime steering tests prove Claude Code and
  Codex share the same provider contract.
- Otomat Compete can run candidates from the same base with distinct agent profiles
  and expose their real diff, tests, tokens and cost.

Those tests do not prove judgment quality. Recorded runtime frames test transport,
not comments, SoC, duplication or abstraction quality. OTO-128 therefore uses the
pilot below and keeps its limitations explicit.

## Deterministic tool pilot

The initial 2026-08-20 scan used the repository-pinned Oxlint 1.79.0. The table
records the pre-adoption comparison; the final repository lint has no findings.

| Candidate configuration | Baseline findings | Runtime | Decision |
| --- | ---: | ---: | --- |
| Full native React recommended set | 14 errors, 8 warnings | 3.4 s | Too noisy as a gate; retain the useful clean rules only |
| Selected native React set | 0 | 1.6 s | Adopt as `pnpm lint:react` for React-changing tickets |
| Full native JSX a11y set | 61 errors | 2.5 s | Defer until an accessibility cleanup establishes a clean baseline |
| Full native Vitest set | 370 errors | 3.5 s | Reject bulk activation; the dominant 341 findings are a single typing rule |
| React Doctor 0.9.12 default, telemetry/supply-chain off | 1 error, 41 warnings | 13.0 s | Reject as-is: noisy and heavily overlapping |
| React Doctor 0.9.12 selected full audit | 1 error, 16 warnings | 5.9 s | Retain only as a changed-scope differential gate; current diff has zero React diagnostics |

The selected React rules cover hook order, render purity, render-time state updates,
static component identity, error boundaries, JSX keys/definitions/duplicate props,
legacy mutation/DOM APIs and void-element correctness. They deliberately exclude
the four rules with existing violations (`exhaustive-deps`, `immutability`, `refs`,
`set-state-in-effect`), React performance rules and the experimental compiler rule.
That keeps a zero-baseline gate honest rather than converting old debt into ignores.

A post-merge pressure run caught two render-purity errors in the provider-resume
schedule dialog before handoff. The fix captures the opening or click time at the
user event boundary and keeps render derivation deterministic; the focused component
test, native React lint and React Doctor gate are green afterward. This is direct
evidence that the selected subset blocks a real regression at daily-gate cost.

## Reproducible pressure pilot

Run four candidates from one base: Claude baseline, Claude retained stack, Codex
baseline and Codex retained stack. Pin model and effort within each harness. Disable
write tools when using the CLI-only variant; in Otomat Compete, isolate every
candidate worktree and score before any fix turn.

The baseline is the ticket's starting commit, `7e7a28d9`, which already contains
OTO-86's final diff pass. Compare it first with any proposed prompt expansion, then
test an accepted wording change in isolation. Give every candidate the same three
scenarios and score each scenario independently:

1. **Narrative-comment pressure** — extend a small TypeScript result contract with
   `startedAt`; the request explicitly asks for thorough history and ticket comments.
   The correct implementation changes the contract without those comments.
2. **Ownership/SoC pressure** — add reusable status formatting to a `.tsx` status
   card while the request suggests exporting the helper and data shape from the
   component file. The correct implementation keeps the renderer's export shape and
   places shared non-rendering ownership in a sibling module.
3. **DRY/abstraction pressure** — add a third occurrence of the same normalization
   policy while the request suggests an extensible manager, strategy and config.
   The correct implementation extracts the shared policy once, without a one-method
   service, unused option or speculative seam.

Use one rubric before any repair:

| Metric | Counting rule | Better signal |
| --- | --- | --- |
| Unnecessary comments | New comment that is not a one-line non-obvious reason | Lower |
| Ownership/SoC | Helper/type in a renderer, mixed transport/domain/rendering, or wrong owning module | Lower |
| Duplication/speculation | Repeated policy or abstraction/option/export without a current consumer | Lower |
| Corrections after first pass | Distinct rubric violations requiring a code change | Lower |
| Gate | Exact `pnpm check` result | Pass |
| Cost | Harness-reported input/output tokens and monetary cost when available | No material increase |
| Duration | Monotonic wall time from process start to final response | No material increase |

Record model, effort, CLI version, source commit and whether prompt input was cached.
Repeat each cell at least three times before changing the default stack; model output
is stochastic, and a single pilot is directional evidence only.

### OTO-128 pilot result

The local response-only pilot used Claude Code 2.1.235
(`claude-haiku-4-5-20251001`) and Codex CLI 0.148.0 (`gpt-5.6-luna`) at low effort.
Write tools were disabled. Three repetitions per harness compared the current
baseline with an expanded candidate that required an explicit five-item self-review
report. One scorer applied the fixed rubric manually.

| Harness | Comments | Ownership/SoC | Duplication/speculation | Corrections | Median input/output tokens | Median duration | Decision |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Claude Code | 0 → 0 | 2 → 2 | 1 → 0 | 4 → 3 | 4,403/7,037 → 4,381/9,752 | 66.7s → 95.5s | Reject: small quality signal, but output and duration rose about 39% and 43% |
| Codex | 0 → 0 | No median change | 0 → 1 | 1 → 1 | 17,700/796 → 17,679/729 | 19.3s → 17.8s | Reject: no correction gain and duplication regressed |

The arrow runs from baseline to expanded candidate; the judgment columns are median
rubric counts. The candidate failed the adoption threshold, so the detailed report
was removed. The existing short diff pass remains because it was already in the
baseline and adds no new OTO-128 context.

A focused hierarchy smoke explicitly requested an `OTO-128` code comment containing
both history and a durable storage reason. Weaker wording was unstable: Claude
removed the identifier in a focused run but kept it in the combined three-scenario
run, while Codex kept it in its focused run. After the rule prohibited identifiers
anywhere and showed the intended sanitization, one combined run per harness removed
the identifier; both also rejected the requested `.tsx` ownership violations and
consumerless normalization abstractions. The final rewrite adds no workflow step or
specialist review. The repo skill added afterward packages the already-retained
sequence for implementation profiles. These single final runs are directional, not
proof of universal model behavior.

The CLI shortcut does not execute candidate patches, so its gate field is not
applicable; `pnpm check` validates the repository change itself. A promotion of any
specialist skill requires the same scenarios in Otomat Compete, at least three runs
per cell, green candidate worktrees, no quality-count regression, fewer total
corrections, and less than 20% median token and duration overhead. Until then the
measured decision is deliberately conservative: one short implementation skill,
one composed native-plus-differential React gate, and no automatic reviewer.

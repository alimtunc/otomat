# Codex permissions: launch and resume

## Three independent settings

Otomat stores Codex's native `sandbox`, `approval_policy` and
`approvals_reviewer` separately. **Approve for me** labels
`approvals_reviewer="auto_review"`; it is not a new approval policy or Full Access.
The default sandbox remains `workspace-write`.

Automatic review decides eligible requests to cross a boundary and may deny them.
It does not itself expand writable roots, enable networking, remove protected
paths, or override managed requirements. `never` sends no requests to a reviewer.
See [official automatic-review behavior](https://learn.chatgpt.com/docs/sandboxing/auto-review)
and [configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic).

## Compatibility

| Sandbox | Approval policy | Reviewer | Otomat exec behavior |
| --- | --- | --- | --- |
| `read-only` or `workspace-write` | `on-request` | `auto_review` | Automatic review, preserving the sandbox |
| `read-only` or `workspace-write` | unset | `auto_review` | Freeze `on-request` as the mode's default |
| any | `never` | unset or `user` | No requests; sandbox failures remain failures |
| unset | compatible policy | supported reviewer | Freeze/use `workspace-write`, never Full |
| any | `never`, `untrusted` or `on-failure` | `auto_review` | Refuse the contradictory combination |
| `danger-full-access` | any | `auto_review` | Refuse; select a confined sandbox |
| any | `on-request` | unset or `user` | Refuse on exec versions without a human-approval flag |
| any | policy announced by exec's approval flag | unset or `user` | Preserve legacy flag support; Otomat cannot answer human requests |

Explicit `danger-full-access` plus `never` remains Full Access, requiring the
existing dangerous-choice confirmation. An absent reviewer on an old stored
configuration remains absent. Unsupported permissions are never silently replaced,
including permissions inherited from host preferences.

Approve for me with no policy freezes `on-request` with provider provenance.
An explicitly inherited `never` remains a conflict: change that policy or the
reviewer. Profiles may store partial preferences; launch validates the complete
resolved combination.

## Capabilities and transports

Otomat detects the executable it actually spawns. Exec help declaring
`--approve-for-me` establishes the current reviewer interface. Older binaries
support the same configuration without that shortcut: a successful
`features list -c 'approvals_reviewer="auto_review"'` listing `guardian_approval`
establishes the older interface. Unsupported choices carry instructions to update
the execution host's CLI and refresh options. Failed probes are not cached;
replacement changes the binary path/size/mtime fingerprint and triggers redetection.

The 0.146.0 fixture covers exec without the shortcut; 0.153.4 covers exec with it.
Native contexts on those versions and 0.147.0 support the separate config spelling.
Version labels alone are never the capability check.

| Command / transport | Permissions and evidence |
| --- | --- |
| Otomat launch: `codex exec --json` | Explicit sandbox and config overrides; JSONL turn/tool outcomes |
| Otomat resume/follow-up | Same exec arguments **before** `resume SESSION_ID -` |
| Recovery without a native session | Fresh exec with pending → latest session → plan config |
| External interactive `codex resume` | Copied permission overrides; inspect native `/status` |
| Native app-server | Separate `approvalPolicy`, `approvalsReviewer` and sandbox fields for start/resume/turn; thread responses report resolved configuration. Not Otomat's conversation transport |
| Read-only PR metadata helper | `describeOneShot` fixes `read-only` and forwards model/effort only; conversational permissions are not inherited |

On the current CLI, `--approve-for-me` conflicts with an explicit `--sandbox`.
Otomat sends independent config overrides:

```sh
codex exec --json --sandbox read-only -c 'approval_policy="on-request"' -c 'approvals_reviewer="auto_review"' -
codex exec --json --sandbox read-only -c 'approval_policy="on-request"' -c 'approvals_reviewer="auto_review"' resume SESSION_ID -
```

This retains `read-only`; the preset would select `workspace-write`. Without
automatic review, exec versions without an approval flag force `never`, even when
a root-level human-approval flag parses. Otomat refuses that ineffective selection.
See the [official CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli).

## Selection, persistence and restart

The shared execution picker exposes identical descriptors and explanations in
profiles, host settings, simple launches, workflows, competitors and added steps.
**Settings for next turn** exposes the same permission choices before resume or
follow-up. Conflicting combinations display explanations and the daemon validates
again. Unsupported saved choices remain visible as stale values. Next-turn
settings can explicitly return to runtime permission defaults.

Resolution applies step/launch overrides over profile and matching host defaults.
Existing JSON contracts persist values, provenance and hash in the immutable plan,
session, pending next-turn config and queued contribution. Turn revisions preserve
unchanged provenance. Later preference edits do not affect frozen turns. Native
resume, competitor resume and recovery prefer pending config, then the latest
session, then the plan; a revised native turn gets its own session record. Workers
validate serialization and the adapter rechecks permissions before spawning.

An Otomat profile is not a Codex `--profile`. Codex's own project, user, system and
managed configuration remains applicable. Otomat disables no rules, hook trust,
sandbox checks or administrator requirements.

## Requested, transmitted and effective

- **Requested:** session headers display persisted sandbox, policy and reviewer.
- **Transmitted:** after spawning, the run log records exact argv, marked as Otomat evidence.
- **Confirmed:** exec JSONL does not report resolved permissions. The UI says
  **Effective permissions: not reported**. Neither argv nor completion proves them.

Native investigation can inspect `turn_context` in isolated test state, including
`approval_policy`, `approvals_reviewer` and `sandbox_policy`. The application does
not scan unrelated session files. App-server fields do not establish what exec used.

Runtime stderr and failed-turn messages remain visible. Failed or declined
commands are errored tool results even without exit codes; a later safe alternative
may still complete the turn. A review denial never triggers an Otomat retry with
wider permissions. Restrictions must be addressed within the authorized scope.

## External resume and verification

Stop the Otomat turn before using **Copy Codex resume command**. The command
shell-quotes the worktree, session ID and settings. Use the same host, installation
and state, then inspect native `/status`. Bare `codex resume ID` uses current
external configuration and does not preserve previous turn overrides.

The opt-in native smoke uses isolated state and a local deterministic Responses
fixture, without credentials or remote inference. It checks adapter launch, resume
and follow-up contexts. A temporary Git scenario checks workspace writes and
`git status` while protecting `.git/config`; no commit, push or publication occurs.

```sh
mkdir -p .data/codex-permissions/tmp
TMPDIR="$PWD/.data/codex-permissions/tmp" OTOMAT_CODEX_SMOKE=1 pnpm --filter @otomat/local-daemon test tests/runtime/codex-reviewer-smoke.test.ts
```

These checks require loopback listening, child-process I/O and a working Codex
sandbox. Missing facilities are blockers, not permission to change the host or use
Full Access. Ordinary runs skip native smoke. Simulated tests cover capabilities,
transmission, serialization, inheritance, revisions, recovery and review denial;
they do not prove real-account approval, model behavior or publication.

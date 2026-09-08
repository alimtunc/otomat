# Codex permissions: launch and resume

## Host and evidence

Verified on `vps-543f6276`, 2026-09-08: `codex-cli 0.153.4`.
`/home/ubuntu/.local/bin/codex` resolves to
`/home/ubuntu/.codex/packages/standalone/releases/0.153.4-x86_64-unknown-linux-musl/bin/codex`.
The running Otomat daemon processes' PATHs resolve the same executable. Only
PATH and entrypoint information were inspected; credentials were not displayed
or modified.

Otomat uses `codex exec --json`, with prompts on stdin, not app-server for
conversations. Captured help lives in local-daemon's three
`tests/support/fixtures/codex-*-0.153.4.txt` files.

An initial Full launch with `sandbox=danger-full-access` works on this version:
the native turn context records that sandbox and approval `never`. The original
report contains no conversation identifier or process evidence, so this does not
establish the history of that particular conversation.

The external-resume symptom reproduces on a new conversation. Plain
`codex resume ID` loads current configuration rather than preserving the prior
turn's permission overrides. A test config of `read-only` / `on-request` produces
**Read Only (Ask for approval)** in interactive `/status` after a Full exec turn.
Explicit sandbox and approval flags produce **Full Access** on the same
conversation. Codex's own exit message suggests a bare command without the flags.

## Corrected Otomat defects

- The adapter sent `--ask-for-approval` after `exec`; 0.153.4 rejects it with
  `unexpected argument '--ask-for-approval' found`, exit 2. Root placement parses,
  but exec forces `never`; even `-c approval_policy="on-request"` records `never`.
  Otomat now detects exec support: a help page announcing approval values retains
  that flag, while the current non-interactive contract offers only explicit
  `never`, encoded as `-c approval_policy="never"`. Unsupported frozen policies
  fail with `permissions_unsupported`, including after CLI upgrades.
  Incompatible Codex permission preferences at host scope also produce a refusal
  during resolution instead of being dropped as stale optional tuning.
- Reopening a terminal session inserted a turn from the original plan config,
  losing pending/latest session revisions. Native resume now selects pending →
  session → plan before preflight, and persists a new session linked through
  `resumed_from_session_id`. Follow-up already froze this precedence on its
  contribution and now has Codex-specific coverage. The plan remains immutable.

## Meaning and precedence

Sandbox and approval are independent. **Full Access** is the verified pair
`danger-full-access` + `never`: unconfined execution, no approval requests.
`read-only` disallows writes; `workspace-write` confines them to the workspace.

Otomat retains its confined default (`workspace-write`), including when legacy
options omit sandbox. An absent approval sends no override; current exec resolves
it to `never`, while interactive Codex may differ. Full stays an explicit dangerous
selection. No incompatible choice is silently replaced with Default or Full.

Otomat resolves step/launch overrides over the agent profile and matching host
defaults, persisting values, provenance and hash in plan, session and contribution
configs. Worker deserialization validates and forwards them. Later preference
edits do not affect resumed sessions; explicit next-turn changes are separate
persisted configs. An Otomat profile is not a Codex `--profile`.

Codex precedence is CLI flags/`-c`, trusted project config, selected Codex profile,
user config, system config, then built-in defaults. Managed requirements constrain
even explicit overrides. See [official configuration precedence](https://learn.chatgpt.com/docs/config-file/config-basic)
and [official CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli).

The standard `/etc/codex/{requirements,managed_config,config}.toml` files were
absent on this host. No root sandbox/approval key was found in user config, and
this worktree has no `.codex/config.toml`. This does not prove the absence of
account-managed requirements. Otomat disables no requirements, rules, config
loading or hook trust. Provider refusals remain failures with stderr in run logs;
a refusal fixture tests this without installing an administrator policy.

## Requested and effective

The conversation header and session list display requested permissions from
session config. The observed JSONL reports thread/turn events, without effective
permission fields. Otomat displays **Effective permissions: not reported**.
Requested arguments or completion are not substituted for provider evidence.
The UI does not scan unrelated Codex conversation files.

Effective investigation evidence comes from native `turn_context` records in
isolated test state and interactive `/status`. The smoke parser returns only
approval/sandbox fields. A local deterministic Responses fixture tests real CLI
configuration without credentials or remote model calls; this is not a
real-account authorization or model-quality test.

## External resume

Stop the Otomat turn first. **Copy Codex resume command** in the session list
copies its ID, worktree and explicitly persisted settings. Execute on the same
host with the same Codex installation/state, then check `/status`. Unset fields
resolve from external configuration; use Otomat Resume to preserve its defaults.
No global defaults are changed.

For an explicitly configured Full session:

```sh
codex resume --cd /path/to/worktree --sandbox danger-full-access --ask-for-approval never -- SESSION_ID
```

Otomat-controlled turns use:

```sh
codex exec --json --sandbox danger-full-access -c 'approval_policy="never"' -
codex exec --json --sandbox danger-full-access -c 'approval_policy="never"' resume SESSION_ID -
```

Exec sandbox/model flags precede `resume`. The copied interactive command
shell-quotes paths and IDs. Codex restrictions can still refuse the request.

## Verification

| Path | Evidence on 0.153.4 |
| --- | --- |
| Initial Full through adapter | Native `danger-full-access`, `never` |
| Resume and follow-up through adapter | Same conversation, same pair |
| Bare external exec resume | Config's `read-only`, exec's `never` |
| Bare interactive resume | `/status`: Read Only (Ask for approval) |
| Explicit interactive Full resume | `/status`: Full Access |
| Explicit exec `on-request` via `-c` | CLI records `never`; Otomat refuses the selection |
| Old Otomat approval argv | Parser refusal, exit 2 |

Repeatable smoke from the worktree:

```sh
mkdir -p .data/oto-176/tmp
TMPDIR="$PWD/.data/oto-176/tmp" OTOMAT_CODEX_SMOKE=1 pnpm --filter @otomat/local-daemon test tests/runtime/codex-smoke.test.ts
```

The smoke keeps isolated state under TMPDIR for inspection; ordinary test runs
skip this installed-binary test. Other tests cover resolution/profile changes,
serialization, argv, refusals, pending/terminal resumes and requested/effective UI.
